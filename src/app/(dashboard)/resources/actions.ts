"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { createdBy, isCreator, isSiteOwner, reportedBy, viewerOf } from "@/lib/resources/access";
import { resourceSearchKey } from "@/lib/resources/normalize";
import { RESOURCE_LIMITS, validateResource, type ResourceInput } from "@/lib/resources/validate";
import { suggestTags } from "@/lib/resources/data";

export type BankResult = { error?: string };

function refresh() {
  revalidatePath("/resources");
  revalidatePath("/resources/moderation");
}

async function tagIds(tags: { name: string; key: string }[]): Promise<string[]> {
  const ids: string[] = [];
  for (const t of tags) {
    // a tag already known under the same normalized key is reused as-is
    const tag = await prisma.tag.upsert({ where: { key: t.key }, update: {}, create: { name: t.name, key: t.key }, select: { id: true } });
    ids.push(tag.id);
  }
  return ids;
}

export async function createResourceAction(input: ResourceInput): Promise<BankResult> {
  const session = await requireSession();
  const viewer = viewerOf(session);
  const clean = validateResource(input);
  if ("error" in clean) return clean;
  const r = clean.resource;
  if (!(await prisma.resourceType.findUnique({ where: { id: r.typeId }, select: { id: true } }))) {
    return { error: "نوع الوسيلة غير موجود" };
  }
  const recent = await prisma.resource.count({
    where: { ...createdBy(viewer), createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (recent >= RESOURCE_LIMITS.perDay) {
    return { error: `بلغ حسابك الحدّ اليومي للإضافة (${RESOURCE_LIMITS.perDay} وسيلة)، ويمكن الإضافة مجددًا بعد مرور يوم` };
  }

  const ids = await tagIds(r.tags);
  await prisma.resource.create({
    data: {
      url: r.url,
      title: r.title,
      description: r.description,
      ageFrom: r.ageFrom,
      ageTo: r.ageTo,
      typeId: r.typeId,
      searchKey: resourceSearchKey(r.title, r.description),
      ...createdBy(viewer),
      tags: { create: ids.map((tagId) => ({ tagId })) },
    },
  });
  refresh();
  return {};
}

// Editing and deleting: the creator, or the site owner (who is also the only
// one who can touch resources whose creator's account is gone).
async function editableResource(resourceId: string) {
  const session = await requireSession();
  const resource = await prisma.resource.findUnique({
    where: { id: String(resourceId ?? "") },
    select: { id: true, createdByAdminId: true, createdByTeacherId: true },
  });
  if (!resource) return { error: "لم يُعثر على الوسيلة" } as const;
  if (!isCreator(viewerOf(session), resource) && !(await isSiteOwner(session))) {
    return { error: "ليست لديك صلاحية تعديل هذه الوسيلة" } as const;
  }
  return { resource } as const;
}

export async function updateResourceAction(resourceId: string, input: ResourceInput): Promise<BankResult> {
  const found = await editableResource(resourceId);
  if ("error" in found) return { error: found.error };
  const clean = validateResource(input);
  if ("error" in clean) return clean;
  const r = clean.resource;
  if (!(await prisma.resourceType.findUnique({ where: { id: r.typeId }, select: { id: true } }))) {
    return { error: "نوع الوسيلة غير موجود" };
  }
  const ids = await tagIds(r.tags);
  await prisma.$transaction([
    prisma.resourceTag.deleteMany({ where: { resourceId: found.resource.id } }),
    prisma.resource.update({
      where: { id: found.resource.id },
      data: {
        url: r.url,
        title: r.title,
        description: r.description,
        ageFrom: r.ageFrom,
        ageTo: r.ageTo,
        typeId: r.typeId,
        searchKey: resourceSearchKey(r.title, r.description),
        tags: { create: ids.map((tagId) => ({ tagId })) },
      },
    }),
  ]);
  refresh();
  return {};
}

export async function deleteResourceAction(resourceId: string): Promise<BankResult> {
  const found = await editableResource(resourceId);
  if ("error" in found) return { error: found.error };
  await prisma.resource.delete({ where: { id: found.resource.id } });
  refresh();
  return {};
}

export async function reportResourceAction(resourceId: string, reason: string): Promise<BankResult> {
  const session = await requireSession();
  const viewer = viewerOf(session);
  const resource = await prisma.resource.findUnique({
    where: { id: String(resourceId ?? "") },
    select: { id: true, hiddenAt: true, createdByAdminId: true, createdByTeacherId: true },
  });
  if (!resource || resource.hiddenAt) return { error: "لم يُعثر على الوسيلة" };
  if (isCreator(viewer, resource)) return { error: "لا يمكن الإبلاغ عن وسيلة مضافة من حسابك" };
  const text = String(reason ?? "").trim();
  if (text.length > RESOURCE_LIMITS.reportReasonMax) return { error: "سبب البلاغ طويل جدًا" };

  const already = await prisma.resourceReport.findFirst({
    where: { resourceId: resource.id, resolvedAt: null, ...reportedBy(viewer) },
    select: { id: true },
  });
  if (already) return { error: "سبق الإبلاغ عن هذه الوسيلة من حسابك، وهو قيد المراجعة" };
  try {
    await prisma.resourceReport.create({ data: { resourceId: resource.id, reason: text || null, ...reportedBy(viewer) } });
  } catch {
    return { error: "سبق الإبلاغ عن هذه الوسيلة من حسابك، وهو قيد المراجعة" };
  }

  // distinct people, since each can hold only one open report per resource
  const open = await prisma.resourceReport.count({ where: { resourceId: resource.id, resolvedAt: null } });
  if (open >= RESOURCE_LIMITS.autoHideAt) {
    await prisma.resource.updateMany({ where: { id: resource.id, hiddenAt: null }, data: { hiddenAt: new Date() } });
  }
  refresh();
  return {};
}

export async function suggestTagsAction(text: string) {
  await requireSession();
  return suggestTags(String(text ?? "").slice(0, 60));
}
