"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { templateSearchKey } from "@/lib/rafiq/templates";
import { checkTemplateText, itemsObject, TEMPLATE_LIMITS } from "@/lib/rafiq/template-rules";
import { RAFIQ_TRACKER_MAX_ITEMS } from "@/lib/rafiq/rules";

// The tracker template bank, for «رفيق الحفظ» users. Publishing takes a
// snapshot of her chosen tracker items; using a template copies its items
// into her own tracker. Every action re-checks her session; the publisher of
// a template is never revealed.

export type BankResult = { error?: string; added?: number };

const SIGNED_OUT = { error: "انتهت الجلسة، يُرجى تسجيل الدخول مرة أخرى" };
const NOT_FOUND = { error: "لم يُعثر على هذا الجدول" };

function refresh() {
  revalidatePath("/rafiq/templates");
  revalidatePath("/rafiq/tracker");
}

/** Publishes a snapshot of some of her current tracker items as a template. */
export async function publishTemplateAction(input: { title: string; description: string; itemIds: string[] }): Promise<BankResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const text = checkTemplateText(input?.title, input?.description);
  if ("error" in text) return { error: text.error };
  const ids = Array.isArray(input.itemIds) ? input.itemIds.map(String) : [];
  if (ids.length === 0) return { error: "يُرجى اختيار بند واحد على الأقل" };
  if (ids.length > TEMPLATE_LIMITS.itemsMax) return { error: `يمكن أن يضم الجدول ${TEMPLATE_LIMITS.itemsMax} بندًا على الأكثر` };

  // only her own items still in use, in her tracker's order
  const items = await prisma.rafiqTrackerItem.findMany({
    where: { id: { in: ids }, userId: user.id, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { title: true, value: true, days: true },
  });
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

/** Adds a template's items to the end of her tracker, as her own independent copies. */
export async function applyTemplateAction(templateId: string): Promise<BankResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const template = await prisma.trackerTemplate.findFirst({
    where: { id: String(templateId ?? ""), OR: [{ hiddenAt: null }, { createdByRafiqId: user.id }] },
    select: { id: true, items: { orderBy: { sortOrder: "asc" }, select: { title: true, value: true, days: true } } },
  });
  if (!template) return NOT_FOUND;
  const active = await prisma.rafiqTrackerItem.count({ where: { userId: user.id, archivedAt: null } });
  const room = RAFIQ_TRACKER_MAX_ITEMS - active;
  if (template.items.length > room) {
    return {
      error: `يضم هذا الجدول ${itemsObject(template.items.length)}، ولا يتّسع جدولك إلا لـ${room} (الحدّ ${RAFIQ_TRACKER_MAX_ITEMS} بندًا) — يُرجى حذف بعض البنود أولًا`,
    };
  }
  await prisma.$transaction([
    prisma.rafiqTrackerItem.createMany({ data: template.items.map((it) => ({ userId: user.id, ...it })) }),
    prisma.trackerTemplate.update({ where: { id: template.id }, data: { useCount: { increment: 1 } } }),
  ]);
  refresh();
  return { added: template.items.length };
}

export async function reportTemplateAction(templateId: string, reason: string): Promise<BankResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
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
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const { count } = await prisma.trackerTemplate.deleteMany({ where: { id: String(templateId ?? ""), createdByRafiqId: user.id } });
  if (count === 0) return NOT_FOUND;
  refresh();
  return {};
}
