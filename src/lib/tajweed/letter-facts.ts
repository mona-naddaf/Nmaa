// What is known about each letter for detailed tajweed errors: its makhraj
// (the 17 of al-Jazariyyah), its sifat, its name, and the letters it is
// commonly confused with. Hafs ʿan ʿAsim (ash-Shatibiyyah). Pure and
// client-safe. Letters are LetterUnit.letter values (src/lib/tajweed/letters.ts).

import { hasShadda, hasSukun, hasTanween, isMaddLetter, type LetterUnit } from "./letters";

// ---------- makharij ----------

export type MakhrajCode =
  | "jawf"
  | "aqsa_halq"
  | "wasat_halq"
  | "adna_halq"
  | "aqsa_lisan_q"
  | "aqsa_lisan_k"
  | "wasat_lisan"
  | "hafat_lisan"
  | "hafat_lisan_adna"
  | "taraf_lisan_n"
  | "taraf_lisan_r"
  | "nitiyya"
  | "asaliyya"
  | "lathawiyya"
  | "shafa_f"
  | "shafatan"
  | "khayshum";

export interface Makhraj {
  code: MakhrajCode;
  label: string;
  /** the letters, shown after the label */
  letters: string;
}

/** Display order: from the deepest to the lips, then the nose. */
export const MAKHARIJ: Makhraj[] = [
  { code: "jawf", label: "الجوف", letters: "حروف المد" },
  { code: "aqsa_halq", label: "أقصى الحلق", letters: "ء هـ" },
  { code: "wasat_halq", label: "وسط الحلق", letters: "ع ح" },
  { code: "adna_halq", label: "أدنى الحلق", letters: "غ خ" },
  { code: "aqsa_lisan_q", label: "أقصى اللسان مع ما فوقه", letters: "ق" },
  { code: "aqsa_lisan_k", label: "أقصى اللسان أسفل قليلًا", letters: "ك" },
  { code: "wasat_lisan", label: "وسط اللسان", letters: "ج ش ي غير المدية" },
  { code: "hafat_lisan", label: "حافة اللسان", letters: "ض" },
  { code: "hafat_lisan_adna", label: "حافة اللسان أدناها", letters: "ل" },
  { code: "taraf_lisan_n", label: "طرف اللسان", letters: "ن" },
  { code: "taraf_lisan_r", label: "طرف اللسان أدخل إلى ظهره", letters: "ر" },
  { code: "nitiyya", label: "طرف اللسان مع أصول الثنايا العليا", letters: "ط د ت" },
  { code: "asaliyya", label: "طرف اللسان مع الثنايا السفلى", letters: "ص ز س" },
  { code: "lathawiyya", label: "طرف اللسان مع أطراف الثنايا العليا", letters: "ظ ذ ث" },
  { code: "shafa_f", label: "بطن الشفة السفلى مع أطراف الثنايا العليا", letters: "ف" },
  { code: "shafatan", label: "الشفتان", letters: "و ب م" },
  { code: "khayshum", label: "الخيشوم", letters: "الغنّة" },
];

const MAKHRAJ_OF: Record<string, MakhrajCode> = {};
const setMakhraj = (letters: string, code: MakhrajCode) => {
  for (const l of letters) MAKHRAJ_OF[l] = code;
};
setMakhraj("ا", "jawf");
setMakhraj("ءه", "aqsa_halq");
setMakhraj("عح", "wasat_halq");
setMakhraj("غخ", "adna_halq");
setMakhraj("ق", "aqsa_lisan_q");
setMakhraj("ك", "aqsa_lisan_k");
setMakhraj("جشي", "wasat_lisan");
setMakhraj("ض", "hafat_lisan");
setMakhraj("ل", "hafat_lisan_adna");
setMakhraj("ن", "taraf_lisan_n");
setMakhraj("ر", "taraf_lisan_r");
setMakhraj("طدتة", "nitiyya");
setMakhraj("صزس", "asaliyya");
setMakhraj("ظذث", "lathawiyya");
setMakhraj("ف", "shafa_f");
setMakhraj("وبم", "shafatan");

export const makhrajByCode = (code: string) => MAKHARIJ.find((m) => m.code === code) ?? null;

/**
 * The makharij a unit may be read from, its own first: و/ي also from the
 * جوف (a madd letter) or vice versa, ى from either, ة also as ه (on a
 * stop), ن/م and any tanween also from the خيشوم (their ghunna). The first
 * one is the unit's likely makhraj in place (a madd و/ي → الجوف).
 */
export function makharijFor(u: LetterUnit, before: LetterUnit | undefined): MakhrajCode[] {
  const list: MakhrajCode[] = [];
  const add = (c: MakhrajCode | undefined) => c && !list.includes(c) && list.push(c);
  const l = u.letter;
  if (l === "و" || l === "ي" || l === "ى") {
    const consonant = l === "و" ? "shafatan" : "wasat_lisan";
    if (isMaddLetter(u, before)) {
      add("jawf");
      add(consonant);
    } else {
      add(consonant);
      add("jawf");
    }
  } else if (l === "ة") {
    add("nitiyya");
    add("aqsa_halq");
  } else {
    add(MAKHRAJ_OF[l]);
  }
  if (l === "ن" || l === "م" || hasTanween(u)) add("khayshum");
  return list;
}

// ---------- sifat ----------

export type SifaCode =
  | "hams"
  | "jahr"
  | "shidda"
  | "tawassut"
  | "rakhawa"
  | "istila"
  | "istifal"
  | "itbaq"
  | "infitah"
  | "safir"
  | "qalqala"
  | "leen"
  | "inhiraf"
  | "takrir"
  | "tafashshi"
  | "istitala";

export const SIFAT: { code: SifaCode; label: string }[] = [
  { code: "hams", label: "الهمس" },
  { code: "jahr", label: "الجهر" },
  { code: "shidda", label: "الشدّة" },
  { code: "tawassut", label: "التوسّط" },
  { code: "rakhawa", label: "الرخاوة" },
  { code: "istila", label: "الاستعلاء" },
  { code: "istifal", label: "الاستفال" },
  { code: "itbaq", label: "الإطباق" },
  { code: "infitah", label: "الانفتاح" },
  { code: "safir", label: "الصفير" },
  { code: "qalqala", label: "القلقلة" },
  { code: "leen", label: "اللين" },
  { code: "inhiraf", label: "الانحراف" },
  { code: "takrir", label: "التكرير" },
  { code: "tafashshi", label: "التفشّي" },
  { code: "istitala", label: "الاستطالة" },
];

// the 28 letters (ة read as ت, ى as ي for sifat)
export const ALPHABET = [..."ءبتثجحخدذرزسشصضطظعغفقكلمنهوي"];
const HAMS = new Set([..."فحثهشخصسكت"]); // فحثه شخص سكت
const SHIDDA = new Set([..."ءجدقطبكت"]); // أجد قط بكت
const TAWASSUT = new Set([..."لنعمر"]); // لن عمر
const ISTILA = new Set([..."خصضغطقظ"]); // خص ضغط قظ
const ITBAQ = new Set([..."صضطظ"]);
const SAFIR = new Set([..."صزس"]);
const QALQALA = new Set([..."قطبجد"]); // قطب جد

/**
 * The sifat of a unit's letter, in SIFAT order. The madd alif has none of
 * its own; و/ي add اللين when sakin after a fatha.
 */
export function sifatFor(u: LetterUnit, before: LetterUnit | undefined): SifaCode[] {
  const l = u.letter === "ة" ? "ت" : u.letter === "ى" ? "ي" : u.letter;
  if (!ALPHABET.includes(l)) return [];
  if ((l === "و" || l === "ي") && isMaddLetter(u, before)) return [];
  const out: SifaCode[] = [];
  out.push(HAMS.has(l) ? "hams" : "jahr");
  out.push(SHIDDA.has(l) ? "shidda" : TAWASSUT.has(l) ? "tawassut" : "rakhawa");
  out.push(ISTILA.has(l) ? "istila" : "istifal");
  out.push(ITBAQ.has(l) ? "itbaq" : "infitah");
  if (SAFIR.has(l)) out.push("safir");
  if (QALQALA.has(l)) out.push("qalqala");
  if ((l === "و" || l === "ي") && hasSukun(u) && before?.marks.includes("َ")) out.push("leen");
  if (l === "ل" || l === "ر") out.push("inhiraf");
  if (l === "ر") out.push("takrir");
  if (l === "ش") out.push("tafashshi");
  if (l === "ض") out.push("istitala");
  return out;
}

// ---------- names and confusions ----------

export const LETTER_NAME: Record<string, string> = {
  "ء": "الهمزة",
  "ا": "الألف",
  "ب": "الباء",
  "ت": "التاء",
  "ث": "الثاء",
  "ج": "الجيم",
  "ح": "الحاء",
  "خ": "الخاء",
  "د": "الدال",
  "ذ": "الذال",
  "ر": "الراء",
  "ز": "الزاي",
  "س": "السين",
  "ش": "الشين",
  "ص": "الصاد",
  "ض": "الضاد",
  "ط": "الطاء",
  "ظ": "الظاء",
  "ع": "العين",
  "غ": "الغين",
  "ف": "الفاء",
  "ق": "القاف",
  "ك": "الكاف",
  "ل": "اللام",
  "م": "الميم",
  "ن": "النون",
  "ه": "الهاء",
  "و": "الواو",
  "ي": "الياء",
  "ة": "التاء المربوطة",
  "ى": "الألف المقصورة",
};

// the common confusions, the closest first
const CONFUSIONS: Record<string, string[]> = {
  "ض": ["ظ", "د"],
  "ظ": ["ض", "ذ", "ز"],
  "د": ["ض", "ت"],
  "ذ": ["ز", "ظ"],
  "ز": ["ذ", "س"],
  "ث": ["س", "ت"],
  "س": ["ص", "ث"],
  "ص": ["س"],
  "ق": ["ك", "غ"],
  "ك": ["ق"],
  "ح": ["ه", "خ"],
  "ه": ["ح", "ء"],
  "ع": ["ء"],
  "ء": ["ع"],
  "ط": ["ت", "د"],
  "ت": ["ط"],
  "ة": ["ط"],
  "غ": ["خ", "ق"],
  "خ": ["ح", "غ"],
};

/**
 * Letters to offer for «نُطق قريبًا من حرف»: the common confusions of this
 * letter first, then the rest of the alphabet (never the letter itself).
 */
export function confusionsFor(letter: string): { suggested: string[]; rest: string[] } {
  const self = letter === "ة" ? "ت" : letter === "ى" ? "ي" : letter;
  const suggested = (CONFUSIONS[letter] ?? []).filter((l) => l !== self);
  const rest = ALPHABET.filter((l) => l !== self && !suggested.includes(l));
  return { suggested, rest };
}

/** «نُطق قريبًا من حرف» accepts one of the 28 letters. */
export const isConfusionLetter = (l: unknown): l is string => typeof l === "string" && ALPHABET.includes(l);

/** Whether the unit is a ن or م with a shadda (الغنّة المشدّدة). */
export const isGhunnaMushaddada = (u: LetterUnit) => (u.letter === "ن" || u.letter === "م") && hasShadda(u);
