"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { addedBy, resolveSubject } from "@/lib/rafiq/subject";
import { templateSearchKey } from "@/lib/rafiq/templates";
import { checkTemplateText, itemsObject, planTemplateApply, TEMPLATE_LIMITS } from "@/lib/rafiq/template-rules";
import { RAFIQ_TRACKER_MAX_ITEMS } from "@/lib/rafiq/rules";
import { nextRafiqSortOrder } from "@/lib/tracker/agenda-data";
import { placeOf } from "@/lib/tracker/agenda";

// The tracker template bank, for «رفيق الحفظ» users. Publishing takes a
// snapshot of her chosen tracker items; using a template copies its items
// into her own tracker (or, «العائلة», a child's: an adult with edit rights
// applies it, and the items count as added by her). Publishing, reporting and
// unpublishing are her own account's only. Every action resolves whose data
// it is (src/lib/rafiq/subject.ts); the publisher of a template is never
// revealed.

// skipped: items left out because her tracker already has their title
export type BankResult = { error?: string; added?: number; skipped?: number };

const NOT_FOUND = { error: "لم يُعثر على هذا الجدول" };

function refresh() {
  revalidatePath("/rafiq/templates");
  revalidatePath("/rafiq/tracker");
}

/** Publishes a snapshot of some of her current tracker items as a template. */
export async function publishTemplateAction(input: { title: string; description: string; itemIds: string[] }): Promise<BankResult> {
  const user = await resolveSubject(null, "self");
  if ("error" in user) return user;
  const text = checkTemplateText(input?.title, input?.description);
  if ("error" in text) return { error: text.error };
  const ids = Array.isArray(input.itemIds) ? input.itemIds.map(String) : [];
  if (ids.length === 0) return { error: "يُرجى اختيار بند واحد على الأقل" };
  if (ids.length > TEMPLATE_LIMITS.itemsMax) return { error: `يمكن أن يضم الجدول ${TEMPLATE_LIMITS.itemsMax} بندًا على الأكثر` };

  // only her own items still in use, in her tracker's order, with their times
  const items = (
    await prisma.rafiqTrackerItem.findMany({
      where: { id: { in: ids }, userId: user.id, archivedAt: null },
      orderBy: { createdAt: "asc" },
      // the every-day timing (a clock time or a prayer anchor) travels with the item
      select: {
        title: true,
        value: true,
        days: true,
        sortOrder: true,
        slots: { where: { weekdays: 127 }, select: { startMin: true, durationMin: true, anchor: true, anchorOffsetMin: true } },
      },
    })
  )
    // in her order (unplaced items last), as her tracker shows them
    .sort((a, b) => placeOf(a.sortOrder) - placeOf(b.sortOrder))
    .map((it) => ({
      title: it.title,
      value: it.value,
      days: it.days,
      startMin: it.slots[0]?.startMin ?? null,
      durationMin: it.slots[0]?.durationMin ?? null,
      anchor: it.slots[0]?.anchor ?? null,
      anchorOffsetMin: it.slots[0]?.anchorOffsetMin ?? null,
    }));
  if (items.length !== ids.length) return { error: "بعض البنود المختارة لم تعد موجودة — يُرجى تحديث الصفحة" };

  const [today, total] = await Promise.all([
    prisma.trackerTemplate.count({ where: { createdByRafiqId: user.id, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    prisma.trackerTemplate.count({ where: { createdByRafiqId: user.id } }),
  ]);
  if (today >= TEMPLATE_LIMITS.perDay) return { error: "تم بلوغ الحدّ اليومي لنشر الجداول، ويمكن النشر مجددًا غدًا" };
  if (total >= TEMPLATE_LIMITS.perUser) return { error: `يمكن نشر ${TEMPLATE_LIMITS.perUser} جدولًا على الأكثر` };

  await prisma.trackerTemplate.create({
    data: {
      title: text.title,
      description: text.description,
      searchKey: templateSearchKey(text.title, text.description),
      createdByRafiqId: user.id,
      items: { createMany: { data: items.map((it, sortOrder) => ({ ...it, sortOrder })) } },
    },
  });
  refresh();
  return {};
}

/**
 * Adds a template's items to the end of her tracker, as her own independent
 * copies — except those whose title her tracker already has.
 */
export async function applyTemplateAction(templateId: string, subjectId?: string): Promise<BankResult> {
  const user = await resolveSubject(subjectId, "manage");
  if ("error" in user) return user;
  const template = await prisma.trackerTemplate.findFirst({
    // her own hidden templates stay usable to her (the adult, on a child's page too)
    where: { id: String(templateId ?? ""), OR: [{ hiddenAt: null }, { createdByRafiqId: user.actorId }] },
    select: { id: true, items: { orderBy: { sortOrder: "asc" }, select: { title: true, value: true, days: true, startMin: true, durationMin: true, anchor: true, anchorOffsetMin: true } } },
  });
  if (!template) return NOT_FOUND;
  const active = await prisma.rafiqTrackerItem.findMany({ where: { userId: user.id, archivedAt: null }, select: { title: true } });
  const room = RAFIQ_TRACKER_MAX_ITEMS - active.length;
  const plan = planTemplateApply(template.items, active.map((i) => i.title), room);
  if ("error" in plan) {
    return {
      error: `${plan.adding === template.items.length ? "يضم هذا الجدول" : "سيُضاف من هذا الجدول"} ${itemsObject(plan.adding)}، ولا يتّسع جدولك إلا لـ${room} (الحدّ ${RAFIQ_TRACKER_MAX_ITEMS} بندًا) — يُرجى حذف بعض البنود أولًا`,
    };
  }
  // every item is already there: nothing to add, and the template wasn't used
  if (plan.create.length === 0) return { added: 0, skipped: plan.skipped };
  // after her own items, in the template's order, each with its time if it had one
  const first = await nextRafiqSortOrder(user.id);
  const by = addedBy(user);
  await prisma.$transaction([
    // a prayer anchor is kept as is: it's placed with her own city (or waits for one)
    ...plan.create.map(({ startMin, durationMin, anchor, anchorOffsetMin, ...it }, i) =>
      prisma.rafiqTrackerItem.create({
        data: {
          userId: user.id,
          ...it,
          adultAdded: by.byAdult,
          createdById: by.adultId,
          // her own order continues (or, never reordered, creation order: 0)
          sortOrder: first > 0 ? first + i : 0,
          ...(startMin !== null || anchor !== null
            ? { slots: { create: { userId: user.id, weekdays: 127, startMin: anchor ? null : startMin, durationMin, anchor, anchorOffsetMin: anchor ? (anchorOffsetMin ?? 0) : null } } }
            : {}),
        },
      }),
    ),
    prisma.trackerTemplate.update({ where: { id: template.id }, data: { useCount: { increment: 1 } } }),
  ]);
  refresh();
  return { added: plan.create.length, skipped: plan.skipped };
}

export async function reportTemplateAction(templateId: string, reason: string): Promise<BankResult> {
  const user = await resolveSubject(null, "self");
  if ("error" in user) return user;
  const template = await prisma.trackerTemplate.findUnique({
    where: { id: String(templateId ?? "") },
    select: { id: true, hiddenAt: true, createdByRafiqId: true },
  });
  if (!template || template.hiddenAt) return NOT_FOUND;
  if (template.createdByRafiqId === user.id) return { error: "لا يمكن الإبلاغ عن جدول منشور من حسابك" };
  const text = String(reason ?? "").trim();
  if (text.length > TEMPLATE_LIMITS.reportReasonMax) return { error: "سبب البلاغ طويل جدًا" };
  const recent = await prisma.trackerTemplateReport.count({
    where: { reporterRafiqId: user.id, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (recent >= TEMPLATE_LIMITS.reportsPerDay) return { error: "تم بلوغ الحدّ اليومي للبلاغات" };

  const ALREADY = { error: "سبق الإبلاغ عن هذا الجدول من حسابك، وهو قيد المراجعة" };
  const already = await prisma.trackerTemplateReport.findFirst({
    where: { templateId: template.id, resolvedAt: null, reporterRafiqId: user.id },
    select: { id: true },
  });
  if (already) return ALREADY;
  try {
    await prisma.trackerTemplateReport.create({ data: { templateId: template.id, reason: text || null, reporterRafiqId: user.id } });
  } catch {
    return ALREADY;
  }
  // distinct people, since each can hold only one open report per template
  const open = await prisma.trackerTemplateReport.count({ where: { templateId: template.id, resolvedAt: null } });
  if (open >= TEMPLATE_LIMITS.autoHideAt) {
    await prisma.trackerTemplate.updateMany({ where: { id: template.id, hiddenAt: null }, data: { hiddenAt: new Date() } });
  }
  refresh();
  return {};
}

/** Her own templates only; copies already taken by others are unaffected. */
export async function unpublishTemplateAction(templateId: string): Promise<BankResult> {
  const user = await resolveSubject(null, "self");
  if ("error" in user) return user;
  const { count } = await prisma.trackerTemplate.deleteMany({ where: { id: String(templateId ?? ""), createdByRafiqId: user.id } });
  if (count === 0) return NOT_FOUND;
  refresh();
  return {};
}
