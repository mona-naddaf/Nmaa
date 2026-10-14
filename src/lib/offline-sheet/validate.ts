import "server-only";
import { prisma } from "@/lib/db";
import { AYAH_COUNT, MUSHAF_ORDER, SURAH_NAME } from "@/lib/quran-data";
import { calculatePageRange, deriveReach, withSession, type PositionSession, type Reach, type SessionType } from "@/lib/recitation/logic";
import { afterRecitationSaved, classifyEntry, classifyPlanEntry, combinedRecords, recitationCreateData, type Quality, type RecitationInput } from "@/lib/recitation/record";
import { entryContext, groupCombos, memorizedRuns, planCombinedEntry, type EntryContext, type EntryPart } from "@/lib/recitation/combined";
import { randomUUID } from "node:crypto";
import { adoptionMessage, orderForRange, reverseOrder, type JuzDirections } from "@/lib/recitation/juz-direction";
import { PLAN_FIELDS, adoptJuzDirection, forPlanPosition, studentPlan, trackContexts } from "@/lib/students/plan";
import { parseSurah, toInteger } from "@/lib/excel/cells";
import { absentWord, presentWord, pickByGroup, pickByPerson, studentNounDef, type GroupGender } from "@/lib/text/gender";
import type { OfflineAccess } from "./access";
import { dateOnlyToISO, sheetDateProblem, sheetOccurredAt } from "./dates";
import { courseTimeZone } from "@/lib/time/course-zone";
import { zoneDayRange } from "@/lib/time/zone";
import { BLOCK_TITLE, BLOCK_TYPES, MAX_POINTS, POINTS_NOTE, QUALITY_LABEL, SECOND_TITLE } from "./layout";
import { planEntryInTrack, trackContext, trackOrder } from "@/lib/recitation/tracks";
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
  // «تم اعتماد اتجاه الجزء …» when this entry decides its juz's direction
  adopted: string | null;
  // a «حفظ جديد» block over memorized ayat: how this surah is saved — its
  // new ayat as new memorization, the memorized ones as «ربط» (one entry);
  // null when saved as written
  parts: EntryPart[] | null;
  // «حفظ جديد — المسار الثاني»: new memorization in her second track
  track?: "SECOND";
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
 * custom alike), covering every surah in between. `orderFor` gives that
 * order (for a reverse plan, the row itself may show a juz's direction).
 */
function readBlock(
  type: SessionType,
  b: RawBlock,
  orderFor: (fromSurah: number, toSurah: number) => number[],
  g: GroupGender,
  errors: string[],
  title = BLOCK_TITLE[type],
): { segments: Segment[]; quality: Quality } | null {
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

  const plan = orderFor(fromSurah, toSurah);
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
  // the course's days (lib/time/zone.ts)
  const timeZone = await courseTimeZone(access.courseId);
  const dateProblem = sheetDateProblem(day, timeZone);
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
      ...PLAN_FIELDS,
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

  // sessions that happened on that day in the course's time zone
  const dayRange = zoneDayRange(timeZone, dateOnlyToISO(day));
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
        createdAt: true,
        comboId: true,
        trackId: true,
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
    const sp = studentPlan(s);
    const plan = sp.plan;
    // the juz directions as this row's entries decide them, one after another
    let directions: JuzDirections | null = sp.directions;

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
      const decided = directions;
      const read = readBlock(type, b, decided ? (from, to) => orderForRange(decided, from, to) : () => plan, g, errors);
      if (read) blocks.push({ type, ...read });
    }

    // «حفظ جديد — المسار الثاني»: only for a student with an active second
    // track, read in that track's order (Mushaf order for a «حر» track)
    let secondBlock: { segments: Segment[]; quality: Quality } | null = null;
    const sb = raw.second;
    if (sb && [sb.fromSurah, sb.fromAyah, sb.toSurah, sb.toAyah, sb.quality].some(Boolean) && (sb.toSurah || sb.toAyah || sb.quality)) {
      const track = sp.second;
      if (!track) {
        errors.push(`${SECOND_TITLE}: ليس ل${studentNounDef(g)} مسار ثانٍ (أو أُنهي بعد تنزيل الملف)`);
      } else {
        const order = track.kind === "FREE" ? MUSHAF_ORDER : trackOrder(track);
        secondBlock = readBlock("NEW", sb, () => order, g, errors, SECOND_TITLE);
      }
    }

    // points
    let requested = 0;
    if (raw.points) {
      const n = toInteger(raw.points);
      if (n == null || n > MAX_POINTS) errors.push(`«النقاط» يجب أن تكون عددًا صحيحًا من 0 إلى ${MAX_POINTS}`);
      else requested = n;
    }

    if (att === "OUT" && (blocks.length > 0 || secondBlock || requested > 0)) {
      errors.push(`${studentWord(g)} ${absentWord(g)} في الملف، ومع ذلك عُبّئ ${pickByGroup(g, { m: "له", f: "لها" })} تسميع أو نقاط`);
    }

    if (errors.length > 0) {
      rows.push(base);
      continue;
    }

    // sessions, in order, each seeing the ones before it
    const existing = sessionsOf.get(s.id) ?? [];
    // a combined entry counts as the one range it was entered as
    const sameDay = groupCombos(existing.filter((x) => x.source === "LOGGED" && x.occurredAt >= dayRange.gte && x.occurredAt < dayRange.lt));
    const positionSessions: PositionSession[] = forPlanPosition(existing, sp.planChangedAt);
    let reach: Reach = deriveReach(plan, positionSessions);
    const rowStart = positionSessions.length;
    for (const { type, segments, quality } of blocks) {
      // a «حفظ جديد» block that covers memorized ayat as well as new ones is
      // saved split, surah by surah, as the recording form does (a surah
      // all memorized becomes «ربط»); a block all memorized stays as written
      // (a re-recording, with its reason)
      const runsOf = (seg: Segment) => memorizedRuns(reach.covered[seg.surahNumber], seg.fromAyah, seg.toAyah);
      const blockRuns = type === "NEW" ? segments.flatMap(runsOf) : [];
      const mixed = blockRuns.some((r) => r.type === "NEW") && blockRuns.some((r) => r.type === "LINK");
      segments.forEach((seg, i) => {
        const key = `${s.id}:${type}:${i}`;
        const pages = calculatePageRange(seg.surahNumber, seg.fromAyah, seg.toAyah);
        const duplicate = sameDay.some(
          (x) =>
            (x.parts ? type === "NEW" : x.type === type) &&
            x.surahNumber === seg.surahNumber &&
            x.fromAyah === seg.fromAyah &&
            x.toAyah === seg.toAyah,
        );
        const runs = mixed ? runsOf(seg) : null;
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
          adopted: null,
          parts: null,
        };
        if (!duplicate && runs && runs.every((r) => r.type === "LINK")) {
          // a surah all memorized inside a mixed block: «ربط»
          entry.parts = [{ type: "LINK", fromAyah: seg.fromAyah, toAyah: seg.toAyah }];
        } else if (!duplicate && runs && runs.length > 1) {
          const ctx: EntryContext = directions ? entryContext(reverseOrder(directions), directions, positionSessions) : { plan, reach, directional: null };
          const combo = planCombinedEntry(ctx, seg.surahNumber, seg.fromAyah, seg.toAyah, g, reasons[key]?.trim() || "…")!;
          entry.parts = combo.parts.map(({ type: t, fromAyah, toAyah }) => ({ type: t, fromAyah, toAyah }));
          entry.requiresReason = combo.requiresReason;
          entry.badgeText = combo.classification?.badgeText ?? null;
          entry.warning = combo.classification?.warningMessage ?? null;
          if (directions && combo.adopt) {
            directions = { ...directions, [combo.adopt.juz]: combo.adopt.direction };
            entry.adopted = adoptionMessage(combo.adopt);
          }
          for (const p of combo.parts.filter((x) => x.type === "NEW")) {
            const saved = { type: "NEW" as const, surahNumber: seg.surahNumber, fromAyah: p.fromAyah, toAyah: p.toAyah, situation: p.situation, reason: p.requiresReason ? reasons[key]?.trim() || "…" : null };
            positionSessions.push(saved);
            reach = withSession(plan, reach, saved);
          }
        } else if (!duplicate) {
          const c = directions
            ? classifyPlanEntry({ plan: reverseOrder(directions), directions }, positionSessions, { type, ...seg }, g)
            : { ...classifyEntry(plan, reach, { type, ...seg }, g), adopt: null };
          entry.requiresReason = c.requiresReason;
          entry.badgeText = c.classification?.badgeText ?? null;
          entry.warning = c.classification?.warningMessage ?? null;
          if (directions && c.adopt) {
            directions = { ...directions, [c.adopt.juz]: c.adopt.direction };
            entry.adopted = adoptionMessage(c.adopt);
          }
          // as if saved with its reason, so what follows is judged the same
          // in both steps
          const saved = {
            type,
            ...seg,
            situation: c.situation,
            reason: c.requiresReason ? reasons[key]?.trim() || "…" : null,
          };
          positionSessions.push(saved);
          reach = withSession(plan, reach, saved);
        }
        base.entries.push(entry);
      });
    }

    // her second track's entries: judged in that track (tracks.ts), each
    // seeing everything before it in this row (the plan's entries too)
    if (secondBlock && sp.second) {
      const track = sp.second;
      const trackSessions = [...existing, ...positionSessions.slice(rowStart).map((x) => ({ ...x, trackId: null }))];
      const { segments, quality } = secondBlock;
      const runsOf = (seg: Segment) => memorizedRuns(reach.covered[seg.surahNumber], seg.fromAyah, seg.toAyah);
      const blockRuns = segments.flatMap(runsOf);
      const mixed = blockRuns.some((r) => r.type === "NEW") && blockRuns.some((r) => r.type === "LINK");
      segments.forEach((seg, i) => {
        const key = `${s.id}:SECOND:${i}`;
        const pages = calculatePageRange(seg.surahNumber, seg.fromAyah, seg.toAyah);
        const duplicate = sameDay.some(
          (x) => (x.parts || x.type === "NEW") && x.surahNumber === seg.surahNumber && x.fromAyah === seg.fromAyah && x.toAyah === seg.toAyah,
        );
        const entry: PreviewEntry = {
          key,
          type: "NEW",
          ...seg,
          quality,
          pages: "error" in pages ? 0 : pages.totalPages,
          duplicate,
          requiresReason: false,
          badgeText: null,
          warning: null,
          adopted: null,
          parts: null,
          track: "SECOND",
        };
        const runs = mixed ? runsOf(seg) : null;
        if (!duplicate && runs && runs.every((r) => r.type === "LINK")) {
          entry.parts = [{ type: "LINK", fromAyah: seg.fromAyah, toAyah: seg.toAyah }];
        } else if (!duplicate) {
          const mainCtx: EntryContext = directions ? entryContext(reverseOrder(directions), directions, positionSessions) : { plan, reach, directional: null };
          const reason = reasons[key]?.trim() || "…";
          const p = planEntryInTrack("SECOND", mainCtx, trackContext(track, trackSessions), seg.surahNumber, seg.fromAyah, seg.toAyah, g, reason);
          if (p.combo) entry.parts = p.combo.parts.map(({ type: t, fromAyah, toAyah }) => ({ type: t, fromAyah, toAyah }));
          entry.requiresReason = p.requiresReason;
          entry.badgeText = p.classification?.badgeText ?? (track.kind === "FREE" ? "حر: دون فحص للفجوات" : null);
          entry.warning = p.classification?.warningMessage ?? null;
          const newParts = p.combo
            ? p.combo.parts.filter((x) => x.type === "NEW")
            : [{ fromAyah: seg.fromAyah, toAyah: seg.toAyah, situation: p.situation, requiresReason: p.requiresReason }];
          for (const part of newParts) {
            const saved = { type: "NEW" as const, surahNumber: seg.surahNumber, fromAyah: part.fromAyah, toAyah: part.toAyah, situation: part.situation, reason: part.requiresReason ? reason : null };
            trackSessions.push({ ...saved, trackId: track.id, createdAt: new Date() } as (typeof trackSessions)[number]);
            // the plan sees its memorization, not its approvals
            positionSessions.push({ ...saved, situation: null });
            reach = withSession(plan, reach, { ...saved, situation: null });
          }
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
  // «فلانة: تم اعتماد اتجاه الجزء …», one per juz direction the entries decided
  directions: string[];
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
  timeZone: string,
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
    directions: [],
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
          const occurredAt = sheetOccurredAt(day, seq++, timeZone, now);
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
            comboId: null as string | null,
            trackId: null as string | null,
          };
          // the rows this entry is saved as: itself, or the parts of a split
          let rowsToSave: RecitationInput[] = [record];
          if (e.parts && e.parts.every((p) => p.type === "LINK")) {
            // a surah all memorized inside a mixed «حفظ جديد» block
            rowsToSave = [{ ...record, type: "LINK", comboId: randomUUID() }];
          } else if (e.track === "SECOND") {
            // her second track: re-judged in that track, as the form would
            const sp = studentPlan(await tx.student.findUniqueOrThrow({ where: { id: r.studentId }, select: PLAN_FIELDS }));
            if (!sp.second) throw new Error(`${r.name}: أُنهي المسار الثاني قبل الحفظ`);
            const sessions = await tx.recitationSession.findMany({
              where: { studentId: r.studentId },
              select: { surahNumber: true, fromAyah: true, toAyah: true, type: true, situation: true, reason: true, createdAt: true, trackId: true },
            });
            const { main, second } = trackContexts(sp, sessions);
            const p = planEntryInTrack("SECOND", main, second, e.surahNumber, e.fromAyah, e.toAyah, r.groupGender, reasons[e.key]?.trim() || "…");
            record.trackId = sp.second.id;
            record.situation = p.situation;
            if (p.requiresReason) {
              const reason = reasons[e.key]?.trim();
              if (!reason) throw new MissingReasonError();
              record.reason = reason;
            }
            if (p.combo) rowsToSave = combinedRecords(record, p.combo);
          } else if (e.type === "NEW") {
            // re-judged here against what's saved so far (in this same
            // transaction), exactly as the form would at that moment
            const sp = studentPlan(await tx.student.findUniqueOrThrow({ where: { id: r.studentId }, select: PLAN_FIELDS }));
            const sessions = await tx.recitationSession.findMany({
              where: { studentId: r.studentId },
              select: { surahNumber: true, fromAyah: true, toAyah: true, type: true, situation: true, reason: true, createdAt: true, trackId: true },
            });
            const positionSessions = forPlanPosition(sessions, sp.planChangedAt);
            const combo = e.parts
              ? planCombinedEntry(entryContext(sp.plan, sp.directions, positionSessions), e.surahNumber, e.fromAyah, e.toAyah, r.groupGender, reasons[e.key]?.trim() || "…")
              : null;
            const c = combo ? { ...combo, situation: null } : classifyPlanEntry(sp, positionSessions, e, r.groupGender);
            record.situation = c.situation;
            if (c.adopt) {
              await adoptJuzDirection(tx, r.studentId, c.adopt);
              summary.directions.push(`${r.name}: ${adoptionMessage(c.adopt)}`);
            }
            if (c.requiresReason) {
              const reason = reasons[e.key]?.trim();
              if (!reason) throw new MissingReasonError();
              record.reason = reason;
            }
            if (combo) rowsToSave = combinedRecords(record, combo);
          }
          for (const row of rowsToSave) {
            const created = recitationCreateData(row);
            if ("error" in created) throw new Error(created.error);
            await tx.recitationSession.create({ data: created.data });
          }
          // the home-log follow-up on the range as entered
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
