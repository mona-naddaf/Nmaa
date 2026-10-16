// The taxonomy of detailed tajweed errors («أخطاء التجويد المفصّلة»): Hafs
// ʿan ʿAsim by way of ash-Shatibiyyah, as in the Madinah mushaf. Pure and
// client-safe. Codes are stored with each error (tajweedCode) and never
// change; labels may change freely without touching stored data.
//
// An error is on a spot: a LETTER (a unit of src/lib/tajweed/letters.ts)
// or the GAP after a word. Its kind is one of three; its code is a rule of
// that kind, or GENERAL ("") when the detail was skipped. A makhraj error's
// code is the makhraj it should come from (letter-facts.ts), with an
// optional «نُطق قريبًا من حرف» letter.

import { LETTER_NAME, MAKHARIJ, SIFAT } from "./letter-facts";

export type TajweedKind = "MAKHRAJ" | "SIFA" | "HUKM";
export type SpotTarget = "LETTER" | "GAP";

/** Picker order of the three kinds. */
export const TAJWEED_KINDS: TajweedKind[] = ["MAKHRAJ", "SIFA", "HUKM"];

export const KIND_LABEL: Record<TajweedKind, string> = {
  MAKHRAJ: "مخرج",
  SIFA: "صفة",
  HUKM: "حكم تجويد",
};

/** The kinds that can be on each target: a gap holds rules only. */
export const KINDS_FOR: Record<SpotTarget, TajweedKind[]> = {
  LETTER: ["MAKHRAJ", "SIFA", "HUKM"],
  GAP: ["HUKM"],
};

/** The code of an error saved without a detail. */
export const GENERAL = "";

export interface HukmRule {
  code: string;
  label: string;
}

export interface HukmGroup {
  code: string;
  label: string;
  /** examples shown under the group's label in the picker */
  hint?: string;
  target: SpotTarget;
  rules: HukmRule[];
}

/** Rules on a letter, in display order. */
export const LETTER_GROUPS: HukmGroup[] = [
  {
    code: "noon",
    label: "النون الساكنة والتنوين",
    target: "LETTER",
    rules: [
      { code: "noon.izhar", label: "إظهار حلقي" },
      { code: "noon.ikhfa", label: "إخفاء" },
      { code: "noon.iqlab", label: "إقلاب" },
    ],
  },
  {
    code: "meem",
    label: "الميم الساكنة",
    target: "LETTER",
    rules: [
      { code: "meem.ikhfa", label: "إخفاء شفوي" },
      { code: "meem.idgham", label: "إدغام شفوي" },
      { code: "meem.izhar", label: "إظهار شفوي" },
    ],
  },
  {
    code: "ghunna",
    label: "الغنّة",
    target: "LETTER",
    rules: [{ code: "ghunna.mushaddad", label: "النون والميم المشدّدتان" }],
  },
  {
    code: "lam",
    label: "اللامات",
    target: "LETTER",
    rules: [
      { code: "lam.qamariyya", label: "لام التعريف القمرية" },
      { code: "lam.shamsiyya", label: "لام التعريف الشمسية" },
      { code: "lam.fil", label: "لام الفعل" },
      { code: "lam.harf", label: "لام الحرف" },
    ],
  },
  {
    code: "tafkhim",
    label: "التفخيم والترقيق",
    target: "LETTER",
    rules: [
      { code: "tafkhim.ra", label: "الراء" },
      { code: "tafkhim.jalala", label: "لام لفظ الجلالة" },
      { code: "tafkhim.alif", label: "الألف المدية (تتبع ما قبلها)" },
      { code: "tafkhim.ghunna", label: "غنّة الإخفاء (تفخيمها قبل حروف الاستعلاء)" },
      { code: "tafkhim.istila", label: "حروف الاستعلاء ومراتب التفخيم" },
      { code: "tafkhim.istifal", label: "ترقيق الحروف المستفلة" },
    ],
  },
  {
    code: "qalqala",
    label: "القلقلة",
    target: "LETTER",
    rules: [
      { code: "qalqala.sughra", label: "صغرى" },
      { code: "qalqala.kubra", label: "كبرى" },
    ],
  },
  {
    code: "madd",
    label: "المدود",
    target: "LETTER",
    rules: [
      { code: "madd.tabii", label: "الطبيعي" },
      { code: "madd.muttasil", label: "المتصل" },
      { code: "madd.lazim.kalimi_muthaqqal", label: "اللازم الكلمي المثقّل" },
      { code: "madd.lazim.kalimi_mukhaffaf", label: "اللازم الكلمي المخفّف" },
      { code: "madd.lazim.harfi_muthaqqal", label: "اللازم الحرفي المثقّل" },
      { code: "madd.lazim.harfi_mukhaffaf", label: "اللازم الحرفي المخفّف" },
      { code: "madd.arid", label: "العارض للسكون" },
      { code: "madd.leen", label: "اللين" },
      { code: "madd.badal", label: "البدل" },
      { code: "madd.iwad", label: "العوض" },
    ],
  },
  {
    code: "idgham_word",
    label: "الإدغام داخل الكلمة",
    target: "LETTER",
    rules: [
      { code: "idgham_word.mutamathilain", label: "متماثلين" },
      { code: "idgham_word.mutajanisain", label: "متجانسين" },
      { code: "idgham_word.mutaqaribain", label: "متقاربين (مثل ﴿نَخْلُقكُّم﴾)" },
    ],
  },
  {
    code: "waqf_word",
    label: "الوقف على الكلمة",
    target: "LETTER",
    rules: [
      { code: "waqf_word.ta_marbuta", label: "التاء المربوطة هاءً" },
      { code: "waqf_word.tanween_fath", label: "تنوين الفتح ألفًا" },
      { code: "waqf_word.rawm_ishmam", label: "الروم والإشمام" },
    ],
  },
  {
    code: "hafs",
    label: "مواضع خاصة لحفص",
    target: "LETTER",
    rules: [
      { code: "hafs.imala", label: "الإمالة ﴿مَجْرَاهَا﴾" },
      { code: "hafs.tashil", label: "التسهيل ﴿ءَأَعْجَمِيٌّ﴾" },
      { code: "hafs.ishmam", label: "الإشمام ﴿تَأْمَنَّا﴾" },
      { code: "hafs.ibdal_tashil", label: "الإبدال/التسهيل ﴿ءَآلذَّكَرَيْنِ﴾" },
      { code: "hafs.seen_sad", label: "السين والصاد ﴿يَبْسُطُ﴾ ﴿بَصْطَةً﴾ ﴿الْمُصَيْطِرُونَ﴾ ﴿بِمُصَيْطِرٍ﴾" },
      { code: "hafs.daf", label: "﴿ضَعْف﴾ بالوجهين" },
    ],
  },
];

/** Rules on the gap between two words, in display order. */
export const GAP_GROUPS: HukmGroup[] = [
  {
    code: "gap_noon",
    label: "النون الساكنة والتنوين",
    target: "GAP",
    rules: [
      { code: "gap_noon.izhar", label: "إظهار" },
      { code: "gap_noon.idgham_ghunna", label: "إدغام بغنّة" },
      { code: "gap_noon.idgham_bila", label: "إدغام بغير غنّة" },
      { code: "gap_noon.iqlab", label: "إقلاب" },
      { code: "gap_noon.ikhfa", label: "إخفاء" },
    ],
  },
  {
    code: "gap_meem",
    label: "الميم الساكنة",
    target: "GAP",
    rules: [
      { code: "gap_meem.idgham", label: "إدغام شفوي" },
      { code: "gap_meem.ikhfa", label: "إخفاء شفوي" },
      { code: "gap_meem.izhar", label: "إظهار شفوي (خصوصًا عند الواو والفاء)" },
    ],
  },
  {
    code: "gap_idgham",
    label: "الإدغام الصغير",
    target: "GAP",
    rules: [
      { code: "gap_idgham.mutamathilain", label: "متماثلين ﴿اضْرِب بِّعَصَاكَ﴾" },
      { code: "gap_idgham.mutajanisain", label: "متجانسين ﴿قَد تَّبَيَّنَ﴾ ﴿إِذ ظَّلَمُوا﴾" },
      { code: "gap_idgham.mutaqaribain", label: "متقاربين ﴿قُل رَّبِّ﴾" },
      { code: "gap_idgham.izhar_yasin_noon", label: "الإظهار في ﴿يس ۚ وَالْقُرْآنِ﴾ و﴿ن ۚ وَالْقَلَمِ﴾" },
    ],
  },
  {
    code: "gap_madd",
    label: "المدود",
    target: "GAP",
    rules: [
      { code: "gap_madd.munfasil", label: "المنفصل" },
      { code: "gap_madd.sila_sughra", label: "الصلة الصغرى" },
      { code: "gap_madd.sila_kubra", label: "الصلة الكبرى" },
      { code: "gap_madd.hadhf", label: "حذف حرف المد لالتقاء الساكنين" },
    ],
  },
  {
    code: "gap_wasl",
    label: "همزة الوصل والتقاء الساكنين",
    target: "GAP",
    rules: [
      { code: "gap_wasl.ithbat", label: "إثبات همزة الوصل في الدرج" },
      { code: "gap_wasl.kasr_tanween", label: "كسر التنوين ﴿نُوحٌ ابْنَهُ﴾" },
    ],
  },
  {
    code: "gap_sakt",
    label: "سكتات حفص",
    hint: "﴿عِوَجًا ۜ قَيِّمًا﴾، ﴿مَّرْقَدِنَا ۜ هَٰذَا﴾، ﴿مَنْ ۜ رَاقٍ﴾، ﴿بَلْ ۜ رَانَ﴾",
    target: "GAP",
    rules: [
      { code: "gap_sakt.tark", label: "ترك السكت" },
      { code: "gap_sakt.ghayr_mawdi", label: "السكت في غير موضعه" },
    ],
  },
  {
    code: "gap_waqf",
    label: "الوقف والابتداء",
    target: "GAP",
    rules: [
      { code: "gap_waqf.qabih", label: "وقف قبيح" },
      { code: "gap_waqf.mamnu", label: "وقف في موضع ممنوع" },
      { code: "gap_waqf.wasl_lazim", label: "وصل في موضع الوقف اللازم" },
      { code: "gap_waqf.ibtida", label: "ابتداء غير صحيح" },
      { code: "gap_waqf.nafas", label: "قطع النَّفَس داخل الكلمة" },
    ],
  },
];

export const groupsFor = (target: SpotTarget) => (target === "LETTER" ? LETTER_GROUPS : GAP_GROUPS);

const HUKM_INDEX = new Map<string, { rule: HukmRule; group: HukmGroup }>();
for (const group of [...LETTER_GROUPS, ...GAP_GROUPS]) for (const rule of group.rules) HUKM_INDEX.set(rule.code, { rule, group });

export const hukmByCode = (code: string) => HUKM_INDEX.get(code) ?? null;

/** Whether `code` is a real code of `kind` on `target` (GENERAL always is). */
export function isCodeFor(kind: TajweedKind, target: SpotTarget, code: string): boolean {
  if (!KINDS_FOR[target].includes(kind)) return false;
  if (code === GENERAL) return true;
  switch (kind) {
    case "MAKHRAJ":
      return MAKHARIJ.some((m) => m.code === code);
    case "SIFA":
      return SIFAT.some((s) => s.code === code);
    case "HUKM":
      return hukmByCode(code)?.group.target === target;
  }
}

/**
 * How one error reads in a list: the kind, and the detail when there is
 * one — e.g. «حكم تجويد · المدود: المتصل», «صفة · الاستطالة»,
 * «مخرج · حافة اللسان». The «نُطق قريبًا من حرف» letter is added by the
 * caller (it's not part of the code).
 */
export function detailLabel(kind: TajweedKind, code: string): { kind: string; detail: string | null } {
  const k = KIND_LABEL[kind];
  if (code === GENERAL) return { kind: k, detail: null };
  if (kind === "MAKHRAJ") return { kind: k, detail: MAKHARIJ.find((m) => m.code === code)?.label ?? null };
  if (kind === "SIFA") return { kind: k, detail: SIFAT.find((s) => s.code === code)?.label ?? null };
  const h = hukmByCode(code);
  return { kind: k, detail: h ? `${h.group.label}: ${h.rule.label}` : null };
}

/**
 * One detailed mistake as a short line, e.g. «صفة · الاستطالة» or
 * «مخرج · حافة اللسان (قريب من الظاء)».
 */
export function detailText(e: { kind: TajweedKind; code: string; confusedWith: string | null }): string {
  const l = detailLabel(e.kind, e.code);
  const confused = e.confusedWith ? ` (قريب من ${LETTER_NAME[e.confusedWith] ?? e.confusedWith})` : "";
  return `${l.kind}${l.detail ? ` · ${l.detail}` : ""}${confused}`;
}
