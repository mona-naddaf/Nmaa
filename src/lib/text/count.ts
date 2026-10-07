// Arabic number–noun agreement for short counts in the UI («كلمة واحدة»،
// «كلمتان»، «3 كلمات»، «11 كلمة»، «100 كلمة»). Each noun's forms are written
// out in full at the call site, same as gender.ts, since they can't be
// derived from one another.

export interface CountForms {
  // 1: «كلمة واحدة»
  one: string;
  // 2: «كلمتان»
  two: string;
  // 3–10 (after the number): «كلمات»
  few: string;
  // 11 and up (after the number): «كلمة»
  many: string;
}

export function countLabel(n: number, forms: CountForms): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const r = n % 100;
  return `${n} ${r >= 3 && r <= 10 ? forms.few : forms.many}`;
}

export const WORDS: CountForms = { one: "كلمة واحدة", two: "كلمتان", few: "كلمات", many: "كلمة" };
export const SURAHS_COUNT: CountForms = { one: "سورة واحدة", two: "سورتان", few: "سور", many: "سورة" };
export const SESSIONS: CountForms = { one: "جلسة واحدة", two: "جلستان", few: "جلسات", many: "جلسة" };
export const GROUPS: CountForms = { one: "مجموعة واحدة", two: "مجموعتان", few: "مجموعات", many: "مجموعة" };
export const SEGMENTS: CountForms = { one: "مقطع واحد", two: "مقطعان", few: "مقاطع", many: "مقطعًا" };
export const ACTIVITIES: CountForms = { one: "نشاط واحد", two: "نشاطان", few: "أنشطة", many: "نشاطًا" };

// after a preposition (منذ / أكثر من): «يوم»، «يومين»، «3 أيام»، «14 يومًا»
export const DAYS_AFTER_PREP: CountForms = { one: "يوم", two: "يومين", few: "أيام", many: "يومًا" };
