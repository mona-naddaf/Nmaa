// Validation shared by adding and editing a resource. Runs on the server in
// the actions (the form's own checks are only for convenience).

import { cleanTagName, tagKey } from "./normalize";

export const RESOURCE_LIMITS = {
  urlMax: 2000,
  titleMax: 120,
  descriptionMax: 1000,
  ageMin: 1,
  ageMax: 25,
  tagsMax: 8,
  tagMax: 30,
  // new resources per person per rolling 24 hours
  perDay: 20,
  reportReasonMax: 300,
  // open reports from different people that hide a resource until reviewed
  autoHideAt: 3,
} as const;

/** The URL as a canonical http(s) string, or null. Never allows javascript:, data:, etc. */
export function parseResourceUrl(raw: string): string | null {
  const text = String(raw ?? "").trim();
  if (!text || text.length > RESOURCE_LIMITS.urlMax || /\s/.test(text)) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname || !url.hostname.includes(".")) return null;
  if (url.username || url.password) return null;
  const href = url.href;
  return href.length <= RESOURCE_LIMITS.urlMax ? href : null;
}

/** Shown on each card, so people can see where a link goes before opening it. */
export function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export type ResourceInput = {
  url: string;
  title: string;
  description: string;
  ageFrom: number;
  ageTo: number;
  typeId: string;
  tags: string[];
};

export type CleanResource = {
  url: string;
  title: string;
  description: string | null;
  ageFrom: number;
  ageTo: number;
  typeId: string;
  // de-duplicated by key; each is { name as typed, key }
  tags: { name: string; key: string }[];
};

export function validateResource(input: ResourceInput): { error: string } | { resource: CleanResource } {
  const L = RESOURCE_LIMITS;
  const url = parseResourceUrl(input.url);
  if (!url) return { error: "يُرجى إدخال رابط صحيح يبدأ بـ http:// أو https://" };

  const title = String(input.title ?? "").trim();
  if (!title) return { error: "يُرجى إدخال عنوان الوسيلة" };
  if (title.length > L.titleMax) return { error: `يُرجى ألّا يتجاوز العنوان ${L.titleMax} حرفًا` };

  const description = String(input.description ?? "").trim();
  if (description.length > L.descriptionMax) return { error: `يُرجى ألّا يتجاوز الوصف ${L.descriptionMax} حرف` };

  const ageFrom = Number(input.ageFrom);
  const ageTo = Number(input.ageTo);
  const validAge = (n: number) => Number.isInteger(n) && n >= L.ageMin && n <= L.ageMax;
  if (!validAge(ageFrom) || !validAge(ageTo)) {
    return { error: `يُرجى إدخال عمرين صحيحين بين ${L.ageMin} و${L.ageMax}` };
  }
  if (ageTo < ageFrom) return { error: "يجب ألّا يقلّ «إلى عمر» عن «من عمر»" };

  const typeId = String(input.typeId ?? "");
  if (!typeId) return { error: "يُرجى اختيار نوع الوسيلة" };

  const raw = Array.isArray(input.tags) ? input.tags : [];
  const seen = new Set<string>();
  const tags: { name: string; key: string }[] = [];
  for (const t of raw) {
    const name = cleanTagName(String(t ?? ""));
    const key = tagKey(name);
    if (!key) continue;
    if (name.length > L.tagMax) return { error: `يُرجى ألّا يتجاوز الوسم ${L.tagMax} حرفًا: «${name.slice(0, 40)}»` };
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push({ name, key });
  }
  if (tags.length > L.tagsMax) return { error: `يمكن إضافة ${L.tagsMax} وسوم على الأكثر` };

  return { resource: { url, title, description: description || null, ageFrom, ageTo, typeId, tags } };
}
