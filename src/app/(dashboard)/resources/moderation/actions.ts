"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { isSiteOwner } from "@/lib/resources/access";
import { cleanTagName, normalizeArabic, tagKey } from "@/lib/resources/normalize";
import { RESOURCE_LIMITS } from "@/lib/resources/validate";

// Site owner only — every action re-checks, whatever the UI shows.

export type ModerationResult = { error?: string };

async function requireOwner(): Promise<boolean> {
  return isSiteOwner(await requireSession());
}

const NOT_OWNER = { error: "هذا الإجراء متاح لمالك الموقع فقط" };

function refresh() {
  revalidatePath("/resources");
  revalidatePath("/resources/moderation");
}

/** Closes every open report on the resource and makes it visible again. */
export async function dismissReportsAction(resourceId: string): Promise<ModerationResult> {
  if (!(await requireOwner())) return NOT_OWNER;
  const id = String(resourceId ?? "");
  await prisma.$transaction([
    prisma.resourceReport.updateMany({ where: { resourceId: id, resolvedAt: null }, data: { resolvedAt: new Date() } }),
    prisma.resource.updateMany({ where: { id }, data: { hiddenAt: null } }),
  ]);
  refresh();
  return {};
}

export async function addResourceTypeAction(nameInput: string): Promise<ModerationResult> {
  if (!(await requireOwner())) return NOT_OWNER;
  const name = cleanTagName(String(nameInput ?? ""));
  if (!name) return { error: "يُرجى إدخال اسم النوع" };
  if (name.length > 30) return { error: "اسم النوع طويل جدًا" };
  const types = await prisma.resourceType.findMany({ select: { name: true, sortOrder: true } });
  if (types.some((t) => normalizeArabic(t.name) === normalizeArabic(name))) return { error: "هذا النوع موجود مسبقًا" };
  await prisma.resourceType.create({
    data: { name, sortOrder: Math.max(-1, ...types.map((t) => t.sortOrder)) + 1 },
  });
  refresh();
  return {};
}

export async function renameTagAction(tagId: string, nameInput: string): Promise<ModerationResult> {
  if (!(await requireOwner())) return NOT_OWNER;
  const name = cleanTagName(String(nameInput ?? ""));
  const key = tagKey(name);
  if (!key) return { error: "يُرجى إدخال اسم الوسم" };
  if (name.length > RESOURCE_LIMITS.tagMax) return { error: `يُرجى ألّا يتجاوز الوسم ${RESOURCE_LIMITS.tagMax} حرفًا` };
  const clash = await prisma.tag.findUnique({ where: { key }, select: { id: true } });
  if (clash && clash.id !== tagId) return { error: "يوجد وسم آخر بهذا الاسم؛ يمكن دمجهما بدلًا من إعادة التسمية" };
  await prisma.tag.update({ where: { id: String(tagId ?? "") }, data: { name, key } });
  refresh();
  return {};
}

/** Moves every resource from `sourceId` to `targetId` (no duplicates), then deletes the source tag. */
export async function mergeTagsAction(sourceId: string, targetId: string): Promise<ModerationResult> {
  if (!(await requireOwner())) return NOT_OWNER;
  const source = String(sourceId ?? "");
  const target = String(targetId ?? "");
  if (!source || !target || source === target) return { error: "يُرجى اختيار وسمين مختلفين" };
  const found = await prisma.tag.count({ where: { id: { in: [source, target] } } });
  if (found !== 2) return { error: "لم يُعثر على أحد الوسمين" };
  await prisma.$transaction([
    prisma.$executeRaw`INSERT INTO "ResourceTag" ("resourceId", "tagId")
      SELECT "resourceId", ${target} FROM "ResourceTag" WHERE "tagId" = ${source}
      ON CONFLICT DO NOTHING`,
    prisma.tag.delete({ where: { id: source } }),
  ]);
  refresh();
  return {};
}
