// Limits and checks for the tracker template bank, shared by the Rafiq and
// site-owner actions (which enforce them) and the forms. Pure.

import { validateDays, validateTitle, validateValue } from "@/lib/tracker/rules";
import { countLabel, type CountForms } from "@/lib/text/count";

export const TEMPLATE_LIMITS = {
  titleMax: 80,
  descriptionMax: 500,
  // items per template (the same as her tracker's maximum)
  itemsMax: 30,
  // new templates per publisher per rolling 24 hours, and in all
  perDay: 5,
  perUser: 50,
  reportReasonMax: 300,
  reportsPerDay: 20,
  // open reports from different people that hide a template until reviewed
  autoHideAt: 3,
} as const;

export type TemplateItemInput = { title: string; value: number; days: number };

/** Cleaned title + description, or an error message. */
export function checkTemplateText(rawTitle: unknown, rawDescription: unknown): { error: string } | { title: string; description: string | null } {
  const title = (typeof rawTitle === "string" ? rawTitle : "").replace(/\s+/g, " ").trim();
  const description = (typeof rawDescription === "string" ? rawDescription : "").trim();
  if (!title) return { error: "يُرجى كتابة عنوان للجدول" };
  if (title.length > TEMPLATE_LIMITS.titleMax) return { error: `يُرجى ألّا يزيد العنوان على ${TEMPLATE_LIMITS.titleMax} حرفًا` };
  if (description.length > TEMPLATE_LIMITS.descriptionMax) return { error: `يُرجى ألّا يزيد الوصف على ${TEMPLATE_LIMITS.descriptionMax} حرف` };
  return { title, description: description || null };
}

/** Each item a valid tracker item; 1 to itemsMax of them. */
export function checkTemplateItems(raw: unknown): { error: string } | { items: TemplateItemInput[] } {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length === 0) return { error: "يُرجى اختيار بند واحد على الأقل" };
  if (list.length > TEMPLATE_LIMITS.itemsMax) return { error: `يمكن أن يضم الجدول ${TEMPLATE_LIMITS.itemsMax} بندًا على الأكثر` };
  const items: TemplateItemInput[] = [];
  for (const it of list) {
    const t = validateTitle(it?.title);
    if ("error" in t) return { error: t.error };
    const value = validateValue(it?.value);
    const days = validateDays(it?.days);
    if (value === null || days === null) return { error: "بيانات أحد البنود غير صحيحة" };
    items.push({ title: t.title, value, days });
  }
  return { items };
}

// "item" counted as an object (يضم … / إضافة …): «بندًا واحدًا / بند واحد»،
// «بندين»، «3 بنود»، «11 بندًا»
const ITEMS_ACC: CountForms = { one: "بندًا واحدًا", two: "بندين", few: "بنود", many: "بندًا" };
const ITEMS_GEN: CountForms = { one: "بند واحد", two: "بندين", few: "بنود", many: "بندًا" };
export const itemsObject = (n: number) => countLabel(n, ITEMS_ACC);
export const itemsAfterNoun = (n: number) => countLabel(n, ITEMS_GEN);
