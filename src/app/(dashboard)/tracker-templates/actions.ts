"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { isSiteOwner } from "@/lib/resources/access";
import { templateSearchKey } from "@/lib/rafiq/templates";
import { checkTemplateItems, checkTemplateText, type TemplateItemInput } from "@/lib/rafiq/template-rules";
import { rafiqEnabled } from "@/lib/rafiq/enabled";

// The tracker template bank, site owner only — every action re-checks,
// whatever the UI shows. The owner reviews reports, deletes any template,
// and adds her own «مقترح» templates. She never sees who published or
// reported a template.

export type OwnerResult = { error?: string };

const NOT_OWNER = { error: "هذا الإجراء متاح لمالك الموقع فقط" };

async function owner(): Promise<boolean> {
  return rafiqEnabled() && isSiteOwner(await requireSession());
}

function refresh() {
  revalidatePath("/tracker-templates");
  revalidatePath("/rafiq/templates");
}

/** Closes every open report on the template and makes it visible again. */
export async function dismissTemplateReportsAction(templateId: string): Promise<OwnerResult> {
  if (!(await owner())) return NOT_OWNER;
  const id = String(templateId ?? "");
  await prisma.$transaction([
    prisma.trackerTemplateReport.updateMany({ where: { templateId: id, resolvedAt: null }, data: { resolvedAt: new Date() } }),
    prisma.trackerTemplate.updateMany({ where: { id }, data: { hiddenAt: null } }),
  ]);
  refresh();
  return {};
}

export async function deleteTemplateAction(templateId: string): Promise<OwnerResult> {
  if (!(await owner())) return NOT_OWNER;
  const { count } = await prisma.trackerTemplate.deleteMany({ where: { id: String(templateId ?? "") } });
  if (count === 0) return { error: "لم يُعثر على هذا الجدول" };
  refresh();
  return {};
}

/** A template of her own, shown first in the bank with «مقترح». */
export async function createSuggestedTemplateAction(input: { title: string; description: string; items: TemplateItemInput[] }): Promise<OwnerResult> {
  if (!(await owner())) return NOT_OWNER;
  const text = checkTemplateText(input?.title, input?.description);
  if ("error" in text) return { error: text.error };
  const checked = checkTemplateItems(input?.items);
  if ("error" in checked) return { error: checked.error };
  await prisma.trackerTemplate.create({
    data: {
      title: text.title,
      description: text.description,
      searchKey: templateSearchKey(text.title, text.description),
      suggested: true,
      items: { createMany: { data: checked.items.map((it, sortOrder) => ({ ...it, sortOrder })) } },
    },
  });
  refresh();
  return {};
}
