"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { familyEnabled } from "@/lib/family/enabled";
import { FAMILY_OFF, SIGNED_OUT } from "@/lib/family/data";
import { editableChildren, type CopyChild } from "@/lib/family/tracker-copy-data";
import { planCopy, reportOf, type CopySource, type ReportLine } from "@/lib/family/tracker-copy";
import { validateDays, validateTitle, validateValue } from "@/lib/tracker/rules";
import { rowTiming, validateSchedule, type SlotRow } from "@/lib/tracker/schedule";
import { placeOf } from "@/lib/tracker/agenda";
import { setRafiqItemSchedule } from "@/lib/tracker/agenda-data";
import { rafiqPlace } from "@/lib/prayer/place-data";
import { RAFIQ_TRACKER_MAX_ITEMS } from "@/lib/rafiq/rules";

// «العائلة»: one new tracker item for several children of a family at once,
// and a whole tracker (a child's, or the adult's own) copied to other
// children. Only an adult, for children of families where she is the
// founder or has edit rights (editableChildren); a child of the same family
// as the source. Every copy is an ordinary item the adults added (locked for
// the child) — nothing links the copies afterwards. What each child gets:
// planCopy (src/lib/family/tracker-copy.ts).

export type CopyResult = { error?: string; report?: ReportLine[] };

const NOT_AVAILABLE = { error: "بعض الأطفال المختارين غير متاحين" };
const NONE = { error: "يُرجى اختيار طفل واحد على الأقل" };
const NOTHING = { error: "لا توجد بنود حالية لنسخها" };

type Pick = CopyChild & { familyId: string };

async function adultWithChildren(): Promise<{ error: string } | { adultId: string; children: Map<string, Pick> }> {
  if (!familyEnabled()) return { error: FAMILY_OFF };
  const adult = await getRafiqUser();
  if (!adult) return { error: SIGNED_OUT };
  const families = await editableChildren(adult.id);
  return { adultId: adult.id, children: new Map(families.flatMap((f) => f.children.map((c) => [c.id, { ...c, familyId: f.id }] as const))) };
}

/** The chosen children: all of them hers to edit, in one family when `familyId` is given. */
function chosen(children: Map<string, Pick>, ids: unknown, familyId?: string): { error: string } | Pick[] {
  if (!Array.isArray(ids) || ids.length === 0) return NONE;
  if (ids.length > 50 || ids.some((i) => typeof i !== "string")) return NOT_AVAILABLE;
  const picks = [...new Set(ids as string[])].map((id) => children.get(id));
  if (picks.some((p) => !p || (familyId !== undefined && p.familyId !== familyId))) return NOT_AVAILABLE;
  return picks as Pick[];
}

function refresh() {
  revalidatePath("/rafiq/tracker");
  revalidatePath("/family", "layout");
  revalidatePath("/rafiq/family", "layout");
}

/** Creates what planCopy allows on one child's tracker (her row locked, so the limit holds), then the times. */
async function giveTo(child: Pick, source: CopySource[], adultId: string): Promise<ReportLine> {
  const hasPlace = (await rafiqPlace(child.id)) !== null;
  const done = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "RafiqUser" WHERE id = ${child.id} FOR UPDATE`;
      const [row, active] = await Promise.all([
        tx.rafiqUser.findUniqueOrThrow({ where: { id: child.id }, select: { agendaEnabled: true } }),
        tx.rafiqTrackerItem.findMany({ where: { userId: child.id, archivedAt: null }, select: { title: true, sortOrder: true } }),
      ]);
      const [plan] = planCopy(source, [{ ...child, titles: active.map((a) => a.title), count: active.length, agenda: row.agendaEnabled, hasPlace }], RAFIQ_TRACKER_MAX_ITEMS);
      // after the rest, in the source's order (0 while she has never reordered: creation order)
      const last = Math.max(0, ...active.map((a) => a.sortOrder));
      const now = Date.now();
      const timed: { id: string; slots: SlotRow[] }[] = [];
      for (const [i, c] of plan.create.entries()) {
        const { id } = await tx.rafiqTrackerItem.create({
          data: {
            userId: child.id,
            title: c.item.title,
            value: c.item.value,
            days: c.item.days,
            sortOrder: last > 0 ? last + 1 + i : 0,
            createdAt: new Date(now + i),
            adultAdded: true,
            createdById: adultId,
          },
          select: { id: true },
        });
        if (c.withTime) timed.push({ id, slots: c.item.slots });
      }
      return { plan, timed };
    },
    { timeout: 20000, maxWait: 10000 },
  );
  for (const t of done.timed) {
    await setRafiqItemSchedule(child.id, t.id, t.slots.map((s) => ({ weekdays: s.weekdays, timing: rowTiming(s) })), hasPlace);
  }
  return reportOf([done.plan], { [child.id]: done.plan.create.length })[0];
}

/** «إضافة إلى:» — one new item for the checked children of the family of `childId` (the tracker she's on). */
export async function addItemToChildrenAction(
  childId: string,
  childIds: string[],
  input: { title: string; value: number; days: number; schedule?: unknown },
): Promise<CopyResult> {
  const a = await adultWithChildren();
  if ("error" in a) return a;
  const here = a.children.get(String(childId ?? ""));
  if (!here) return NOT_AVAILABLE;
  const targets = chosen(a.children, childIds, here.familyId);
  if ("error" in targets) return targets;
  const t = validateTitle(input?.title);
  if ("error" in t) return { error: t.error };
  const value = validateValue(input?.value);
  if (value === null) return { error: "يُرجى اختيار درجة من 1 إلى 10" };
  const days = validateDays(input?.days);
  if (days === null) return { error: "يُرجى اختيار يوم واحد على الأقل" };
  // its time as entered (prayer times allowed here; each child's city decides later)
  const slots = Array.isArray(input?.schedule) ? validateSchedule(input.schedule, true) : [];
  if (slots === null) return { error: "الوقت غير صحيح" };
  const report: ReportLine[] = [];
  for (const child of targets) report.push(await giveTo(child, [{ title: t.title, value, days, slots }], a.adultId));
  refresh();
  return { report };
}

/** «نسخ الجدول إلى…» (from a child of hers: `from` is her id) and «نسخ جدولي إلى…» (`from` null: her own). */
export async function copyTrackerAction(from: string | null, childIds: string[]): Promise<CopyResult> {
  const a = await adultWithChildren();
  if ("error" in a) return a;
  let sourceId = a.adultId;
  let familyId: string | undefined;
  if (from !== null) {
    const src = a.children.get(String(from ?? ""));
    if (!src) return NOT_AVAILABLE;
    sourceId = src.id;
    familyId = src.familyId;
  }
  const targets = chosen(a.children, childIds, familyId);
  if ("error" in targets) return targets;
  const rows = await prisma.rafiqTrackerItem.findMany({
    where: { userId: sourceId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { title: true, value: true, days: true, sortOrder: true, slots: { select: { weekdays: true, startMin: true, durationMin: true, anchor: true, anchorOffsetMin: true } } },
  });
  // her order, as her tracker shows it
  rows.sort((x, y) => placeOf(x.sortOrder) - placeOf(y.sortOrder));
  if (rows.length === 0) return NOTHING;
  const source: CopySource[] = rows.map(({ title, value, days, slots }) => ({ title, value, days, slots }));
  const report: ReportLine[] = [];
  for (const child of targets) if (child.id !== sourceId) report.push(await giveTo(child, source, a.adultId));
  if (report.length === 0) return NONE;
  refresh();
  return { report };
}
