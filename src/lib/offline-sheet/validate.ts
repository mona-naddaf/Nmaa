import "server-only";
import { prisma } from "@/lib/db";
import { AYAH_COUNT, SURAH_NAME } from "@/lib/quran-data";
import { calculatePageRange, deriveReach, withSession, type Reach, type SessionType } from "@/lib/recitation/logic";
import { afterRecitationSaved, classifyEntry, recitationCreateData, type Quality } from "@/lib/recitation/record";
import { parseSurah, toInteger } from "@/lib/excel/cells";
import { absentWord, presentWord, pickByGroup, pickByPerson, studentNounDef, type GroupGender } from "@/lib/text/gender";
import type { OfflineAccess } from "./access";
import { dateOnlyToISO, sheetDateProblem, sheetOccurredAt } from "./dates";
import { BLOCK_TITLE, BLOCK_TYPES, MAX_POINTS, POINTS_NOTE, QUALITY_LABEL } from "./layout";
import type { RawBlock, RawRow, RawSheet } from "./parse";

// Everything an upload would save, checked on the server: the preview (step
// 1) and the save (step 2) both run validateSheet on the file itself — the
// save never trusts the preview — so they can't disagree, and anything that
// changed in between (a session recorded on the site, a student archived)
// is caught. A row with any error is not saved; the rest are.
//
// Recitations are classified and stored exactly as the recitation form
// does (lib/recitation/record.ts), in order, each seeing the ones before it.

export type AttendanceValue = "IN" | "OUT";

export interface PreviewEntry {
  // stable across both steps: "studentId:TYPE:n" (the n-th session of that block)
  key: string;
  type: SessionType;
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  quality: Quality;
  pages: number;
  // already saved for this student on this day (same type, surah and ayat): skipped
  duplicate: boolean;
  requiresReason: boolean;
  badgeText: string | null;
  warning: string | null;
}

export interface PreviewRow {
  sheet: string;
  row: number;
  studentId: string;
  name: string;
  groupName: string;
  groupGender: GroupGender;
  errors: string[];
  warnings: string[];
  attendance: { value: AttendanceValue; previous: AttendanceValue | null } | null;
  entries: PreviewEntry[];
  points: { requested: number; alreadySaved: number; toAdd: number } | null;
}

export type SheetCheck =
  | { fatal: string }
  | {
      date: string;
      rows: PreviewRow[];
      // rows with an id and nothing to save (only the pre-filled «من»)
      emptyRows: number;
    };

const QUALITY_BY_LABEL = new Map(Object.entries(QUALITY_LABEL).map(([k, v]) => [v, k as Quality]));

const studentWord = (g: GroupGender) => pickByGroup(g, { m: "الطالب", f: "الطالبة" });

function readAttendance(text: string): AttendanceValue | null | "bad" {
  if (!text) return null;
  if (text === "حاضر" || text === "حاضرة") return "IN";
  if (text === "غائب" || text === "غائبة") return "OUT";
  return "bad";
}

interface Segment {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
}

/**
 * One block → its sessions (one per surah), or null with errors. Within one
 * surah, from ≤ to; across surahs both must be in her plan and «إلى سورة»
 * must come after «من سورة» in its order (forward, reverse, Juz Amma or
 * custom alike), covering every surah in between.
 */
function readBlock(
  type: SessionType,
  b: RawBlock,
  plan: number[],
  g: GroupGender,
  errors: string[],
): { segments: Segment[]; quality: Quality } | null {
  const title = BLOCK_TITLE[type];
  const blockErrors: string[] = [];
  const fromSurah = parseSurah(b.fromSurah, `${title}: من سورة`, blockErrors);
  const toSurahOrNull = parseSurah(b.toSurah, `${title}: إلى سورة`, blockErrors);
  if (!b.fromSurah) blockErrors.push(`${title}: «من سورة» فارغة`);
  const fromAyah = toInteger(b.fromAyah);
  const toAyah = toInteger(b.toAyah);
  if (!b.fromAyah) blockErrors.push(`${title}: «من آية» فارغة`);
  else if (fromAyah == null || fromAyah < 1) blockErrors.push(`${title}: «من آية» ليست رقمًا صحيحًا`);
  if (!b.toAyah) blockErrors.push(`${title}: «إلى آية» فارغة`);
  else if (toAyah == null || toAyah < 1) blockErrors.push(`${title}: «إلى آية» ليست رقمًا صحيحًا`);
  const quality = QUALITY_BY_LABEL.get(b.quality);
  if (!b.quality) blockErrors.push(`${title}: التقييم فارغ`);
  else if (!quality) blockErrors.push(`${title}: التقييم «${b.quality}» غير معروف`);
  if (blockErrors.length > 0 || fromSurah == null || fromAyah == null || toAyah == null || !quality) {
    errors.push(...blockErrors);
    return null;
  }

  const toSurah = toSurahOrNull ?? fromSurah;
  if (toSurah === fromSurah) {
    if (fromAyah > toAyah) {
      errors.push(`${title}: «من آية» (${fromAyah}) بعد «إلى آية» (${toAyah})`);
      return null;
    }
    const range = calculatePageRange(fromSurah, fromAyah, toAyah);
    if ("error" in range) {
      errors.push(`${title}: سورة ${SURAH_NAME[fromSurah]} — ${range.error}`);
      return null;
    }
    return { segments: [{ surahNumber: fromSurah, fromAyah, toAyah }], quality };
  }

  const a = plan.indexOf(fromSurah);
  const z = plan.indexOf(toSurah);
  if (a === -1 || z === -1) {
    const missing = a === -1 ? fromSurah : toSurah;
    errors.push(`${title}: سورة ${SURAH_NAME[missing]} ليست في خطة ${studentNounDef(g)}، ولا يمتد التسميع إلى أكثر من سورة إلا داخل الخطة`);
    return null;
  }
  if (z < a) {
    errors.push(`${title}: سورة ${SURAH_NAME[toSurah]} تأتي قبل سورة ${SURAH_NAME[fromSurah]} في ترتيب خطة ${studentNounDef(g)}`);
    return null;
  }
  if (fromAyah > AYAH_COUNT[fromSurah]) {
    errors.push(`${title}: سورة ${SURAH_NAME[fromSurah]} فيها ${AYAH_COUNT[fromSurah]} آية فقط`);
    return null;
  }
  if (toAyah > AYAH_COUNT[toSurah]) {
    errors.push(`${title}: سورة ${SURAH_NAME[toSurah]} فيها ${AYAH_COUNT[toSurah]} آية فقط`);
    return null;
  }
  const segments = plan.slice(a, z + 1).map((surahNumber, i, all) => ({
    surahNumber,
    fromAyah: i === 0 ? fromAyah : 1,
    toAyah: i === all.length - 1 ? toAyah : AYAH_COUNT[surahNumber],
  }));
  return { segments, quality };
}

/**
 * Checks a parsed sheet against the course as it is now. `access` limits it
 * to her groups; `reasons` (step 2) are the gap/re-recording reasons typed
 * in the preview, keyed like PreviewEntry.key.
 */
export async function validateSheet(
  access: OfflineAccess,
  sheet: Extract<RawSheet, { rows: RawRow[] }>,
  reasons: Record<string, string> = {},
): Promise<SheetCheck> {
  if (!sheet.date) {
    return { fatal: `تاريخ الملف ${sheet.dateText ? `«${sheet.dateText}» ` : ""}غير صحيح. يُرجى كتابته بالصيغة سنة-شهر-يوم.` };
  }
  const day = sheet.date;
  const dateProblem = sheetDateProblem(day);
  if (dateProblem) return { fatal: `${dateProblem} (${dateOnlyToISO(day)}).` };

  // every id in the file must be a student of this course that she can
  // see — anything else rejects the whole file
  const ids = [...new Set(sheet.rows.map((r) => r.studentId).filter(Boolean))];
  const students = await prisma.student.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      courseId: true,
      groupId: true,
      archivedAt: true,
      group: { select: { name: true, gender: true } },
      planItems: { orderBy: { position: "asc" }, select: { surahNumber: true } },
    },
  });
  const byId = new Map(students.map((s) => [s.id, s]));
  for (const id of ids) {
    const s = byId.get(id);
    if (!s || s.courseId !== access.courseId || (access.groupLimit && !access.groupLimit.includes(s.groupId))) {
      const own = pickByPerson(access.viewerGender, { m: "تملك", f: "تملكين" });
      return { fatal: `في الملف سطور لا تخص طلابًا ${own} صلاحية عليهم في هذه الدورة، فرُفض الملف كله. يُرجى تنزيل الملف من جديد.` };
    }
  }

  const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
  const [allSessions, attendance, points] = await Promise.all([
    prisma.recitationSession.findMany({
      where: { studentId: { in: ids } },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      select: {
        studentId: true,
        source: true,
        type: true,
        surahNumber: true,
        fromAyah: true,
        toAyah: true,
        situation: true,
        reason: true,
        occurredAt: true,
      },
    }),
    prisma.attendanceLog.findMany({ where: { studentId: { in: ids }, day }, select: { studentId: true, status: true } }),
    prisma.pointsLog.groupBy({
      by: ["studentId"],
      where: { studentId: { in: ids }, day, activityId: null, note: POINTS_NOTE },
      _count: { _all: true },
    }),
  ]);
  const sessionsOf = new Map<string, typeof allSessions>();
  for (const s of allSessions) sessionsOf.set(s.studentId, [...(sessionsOf.get(s.studentId) ?? []), s]);
  const attendanceOf = new Map(attendance.map((a) => [a.studentId, a.status as AttendanceValue]));
  const pointsOf = new Map(points.map((p) => [p.studentId, p._count._all]));

  const seen = new Map<string, string>();
  const rows: PreviewRow[] = [];
  let emptyRows = 0;

  for (const raw of sheet.rows) {
    const where = `«${raw.sheet}» السطر ${raw.row}`;
    if (!raw.studentId) {
      rows.push(emptyRow(raw, [`سطر أُضيف يدويًا دون معرّف (${where})؛ لا يمكن ربطه بأي طالب. يُضاف الطلاب الجدد من الموقع.`]));
      continue;
    }
    const s = byId.get(raw.studentId)!;
    const g = s.group.gender;
    const base: PreviewRow = {
      sheet: raw.sheet,
      row: raw.row,
      studentId: s.id,
      name: s.name,
      groupName: s.group.name,
      groupGender: g,
      errors: [],
      warnings: [],
      attendance: null,
      entries: [],
      points: null,
    };
    if (seen.has(s.id)) {
      rows.push({ ...base, errors: [`${studentNounDef(g)} مكرَّرة في الملف (سبق في ${seen.get(s.id)})`] });
      continue;
    }
    seen.set(s.id, where);
    if (s.archivedAt) {
      rows.push({ ...base, warnings: [`${pickByGroup(g, { m: "نُقل", f: "نُقلت" })} إلى الأرشيف بعد تنزيل الملف، فلن يُحفظ ${pickByGroup(g, { m: "له", f: "لها" })} شيء`] });
      continue;
    }

    const errors = base.errors;
    const plan = s.planItems.map((p) => p.surahNumber);

    // attendance
    const att = readAttendance(raw.attendance);
    if (att === "bad") errors.push(`الحضور «${raw.attendance}» غير معروف (${presentWord(g)} أو ${absentWord(g)})`);
    else if (att) base.attendance = { value: att, previous: attendanceOf.get(s.id) ?? null };

    // blocks: an untouched new-memorization block (only its pre-filled
    // «من») is empty; any other partly filled block is an error
    const blocks: { type: SessionType; segments: Segment[]; quality: Quality }[] = [];
    for (const type of BLOCK_TYPES) {
      const b = raw.blocks[type];
      const filled = [b.fromSurah, b.fromAyah, b.toSurah, b.toAyah, b.quality].some(Boolean);
      if (!filled) continue;
      if (type === "NEW" && !b.toSurah && !b.toAyah && !b.quality) continue;
      const read = readBlock(type, b, plan, g, errors);
      if (read) blocks.push({ type, ...read });
    }

    // points
    let requested = 0;
    if (raw.points) {
      const n = toInteger(raw.points);
      if (n == null || n > MAX_POINTS) errors.push(`«النقاط» يجب أن تكون عددًا صحيحًا من 0 إلى ${MAX_POINTS}`);
      else requested = n;
    }

    if (att === "OUT" && (blocks.length > 0 || requested > 0)) {
      errors.push(`${studentWord(g)} ${absentWord(g)} في الملف، ومع ذلك عُبّئ ${pickByGroup(g, { m: "له", f: "لها" })} تسميع أو نقاط`);
    }

    if (errors.length > 0) {
      rows.push(base);
      continue;
    }

    // sessions, in order, each seeing the ones before it
    const existing = sessionsOf.get(s.id) ?? [];
    const sameDay = existing.filter((x) => x.source === "LOGGED" && x.occurredAt >= day && x.occurredAt < nextDay);
    let reach: Reach = deriveReach(plan, existing);
    for (const { type, segments, quality } of blocks) {
      segments.forEach((seg, i) => {
        const key = `${s.id}:${type}:${i}`;
        const pages = calculatePageRange(seg.surahNumber, seg.fromAyah, seg.toAyah);
        const duplicate = sameDay.some(
          (x) => x.type === type && x.surahNumber === seg.surahNumber && x.fromAyah === seg.fromAyah && x.toAyah === seg.toAyah,
        );
        const entry: PreviewEntry = {
          key,
          type,
          ...seg,
          quality,
          pages: "error" in pages ? 0 : pages.totalPages,
          duplicate,
          requiresReason: false,
          badgeText: null,
          warning: null,
        };
        if (!duplicate) {
          const c = classifyEntry(plan, reach, { type, ...seg }, g);
          entry.requiresReason = c.requiresReason;
          entry.badgeText = c.classification?.badgeText ?? null;
          entry.warning = c.classification?.warningMessage ?? null;
          // as if saved with its reason, so what follows is judged the same
          // in both steps
          reach = withSession(plan, reach, {
            type,
            ...seg,
            situation: c.situation,
            reason: c.requiresReason ? reasons[key]?.trim() || "…" : null,
          });
        }
        base.entries.push(entry);
      });
    }

    if (requested > 0 || raw.points) {
      const already = pointsOf.get(s.id) ?? 0;
      base.points = { requested, alreadySaved: already, toAdd: Math.max(0, requested - already) };
    }

    const nothing = !base.attendance && base.entries.length === 0 && !(base.points && base.points.requested > 0);
    if (nothing) {
      emptyRows++;
      continue;
    }
    rows.push(base);
  }

  return { date: dateOnlyToISO(day), rows, emptyRows };
}

function emptyRow(raw: RawRow, errors: string[]): PreviewRow {
  return {
    sheet: raw.sheet,
    row: raw.row,
    studentId: "",
    name: raw.name || "—",
    groupName: raw.sheet,
    groupGender: "MIXED",
    errors,
    warnings: [],
    attendance: null,
    entries: [],
    points: null,
  };
}

/** Entries that still need a reason typed before the save. */
export const missingReasons = (rows: PreviewRow[], reasons: Record<string, string>) =>
  rows
    .filter((r) => r.errors.length === 0)
    .flatMap((r) => r.entries)
    .filter((e) => e.requiresReason && !e.duplicate && !reasons[e.key]?.trim());

export interface SaveSummary {
  students: number;
  sessions: number;
  duplicates: number;
  attendance: number;
  attendanceChanged: number;
  points: number;
  notSaved: number;
}

/**
 * Saves every row without errors, all together or nothing: attendance (the
 * file wins), new sessions (duplicates skipped), and bonus points up to the
 * number written (ones already saved from a file that day count).
 */
export async function saveSheet(
  check: Extract<SheetCheck, { rows: PreviewRow[] }>,
  reasons: Record<string, string>,
  teacherId: string,
): Promise<SaveSummary> {
  const day = new Date(`${check.date}T00:00:00Z`);
  const now = new Date();
  const ok = check.rows.filter((r) => r.errors.length === 0 && r.studentId && (r.attendance || r.entries.length || r.points));
  const summary: SaveSummary = {
    students: 0,
    sessions: 0,
    duplicates: 0,
    attendance: 0,
    attendanceChanged: 0,
    points: 0,
    notSaved: check.rows.filter((r) => r.errors.length > 0).length,
  };
  const saved: Parameters<typeof afterRecitationSaved>[0][] = [];

  await prisma.$transaction(
    async (tx) => {
      for (const r of ok) {
        let touched = false;
        if (r.attendance) {
          await tx.attendanceLog.upsert({
            where: { studentId_day: { studentId: r.studentId, day } },
            update: { status: r.attendance.value, teacherId },
            create: { studentId: r.studentId, day, status: r.attendance.value, teacherId },
          });
          summary.attendance++;
          if (r.attendance.previous && r.attendance.previous !== r.attendance.value) summary.attendanceChanged++;
          touched = true;
        }
        let seq = 0;
        for (const e of r.entries) {
          if (e.duplicate) {
            summary.duplicates++;
            continue;
          }
          const occurredAt = sheetOccurredAt(day, seq++, now);
          const record = {
            studentId: r.studentId,
            teacherId,
            type: e.type,
            surahNumber: e.surahNumber,
            fromAyah: e.fromAyah,
            toAyah: e.toAyah,
            quality: e.quality,
            mode: "IN_PERSON" as const,
            situation: null as ReturnType<typeof classifyEntry>["situation"],
            reason: null as string | null,
            notes: null,
            occurredAt,
          };
          if (e.type === "NEW") {
            // re-judged here against what's saved so far (in this same
            // transaction), exactly as the form would at that moment
            const plan = (await tx.planItem.findMany({ where: { studentId: r.studentId }, orderBy: { position: "asc" }, select: { surahNumber: true } })).map(
              (p) => p.surahNumber,
            );
            const sessions = await tx.recitationSession.findMany({
              where: { studentId: r.studentId },
              select: { surahNumber: true, fromAyah: true, toAyah: true, type: true, situation: true, reason: true },
            });
            const c = classifyEntry(plan, deriveReach(plan, sessions), e, r.groupGender);
            record.situation = c.situation;
            if (c.requiresReason) {
              const reason = reasons[e.key]?.trim();
              if (!reason) throw new MissingReasonError();
              record.reason = reason;
            }
          }
          const created = recitationCreateData(record);
          if ("error" in created) throw new Error(created.error);
          await tx.recitationSession.create({ data: created.data });
          saved.push(record);
          summary.sessions++;
          touched = true;
        }
        if (r.points && r.points.toAdd > 0) {
          await tx.pointsLog.createMany({
            data: Array.from({ length: r.points.toAdd }, () => ({
              studentId: r.studentId,
              activityId: null,
              note: POINTS_NOTE,
              teacherId,
              valueAtTime: 1,
              typeAtTime: "ADD" as const,
              day,
            })),
          });
          summary.points += r.points.toAdd;
          touched = true;
        }
        if (touched) summary.students++;
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  for (const record of saved) await afterRecitationSaved(record);
  return summary;
}

export class MissingReasonError extends Error {
  constructor() {
    super("missing reason");
  }
}
