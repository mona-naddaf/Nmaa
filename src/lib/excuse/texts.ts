import { addDays } from "@/lib/tracker/rules";
import { clockLabel } from "@/lib/tracker/agenda";
import { GREGORIAN_MONTHS } from "@/lib/calendar/hijri";
import { countLabel, DAYS_AFTER_PREP } from "@/lib/text/count";
import { EXCUSE_LIMITS, type Moment, type MomentError } from "./rules";

// «أيام العذر»: the approved wording (review page, 2026-10-27) that depends
// on data. Pure. Only ever shown to someone who may see the excuse
// (visibility.ts); everyone else gets no text at all.

type G = "MALE" | "FEMALE" | null;

/** «معذورة اليوم»، «معذورة منذ أمس»، «منذ يومين»، «منذ 3 أيام»، «منذ 11 يومًا». name: another viewer's line («سارة معذورة …»). */
export function sinceLabel(startDay: string, today: string, name?: string): string {
  const n = Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`)) / 86400000));
  const since = n === 0 ? "معذورة اليوم" : n === 1 ? "معذورة منذ أمس" : `معذورة منذ ${countLabel(n, DAYS_AFTER_PREP)}`;
  return name ? `${name} ${since}` : since;
}

/** «اليوم 9:40 م»، «أمس 9:40 م»، «12 أكتوبر 9:40 م». */
export function momentLabel(at: Moment, today: string): string {
  const [, m, d] = at.day.split("-").map(Number);
  const day = at.day === today ? "اليوم" : at.day === addDays(today, -1) ? "أمس" : `${d} ${GREGORIAN_MONTHS[m - 1]}`;
  return `${day} ${clockLabel(at.min)}`;
}

/** Who started or ended it, as the record shows them. */
export type Actor =
  | { kind: "STUDENT" }
  | { kind: "TEACHER"; name: string }
  | { kind: "SUPERVISOR"; gender: G }
  // «رفيق الحفظ» and the family: the girl herself or an adult, by name
  | { kind: "PERSON"; name: string; gender: "MALE" | "FEMALE" };

function actorWords(a: Actor): { name: string; male: boolean } {
  if (a.kind === "STUDENT") return { name: "الطالبة", male: false };
  if (a.kind === "TEACHER") return { name: `المعلمة ${a.name}`, male: false };
  if (a.kind === "SUPERVISOR") return { name: a.gender === "MALE" ? "المشرف" : "المشرفة", male: a.gender === "MALE" };
  return { name: a.name, male: a.gender === "MALE" };
}

/** «بدأته سارة · أمس 9:40 م»، «بدأه أحمد · …»، «أنهته المعلمة نورة · …»؛ an automatic end: «انتهى تلقائيًا بعد 15 يومًا». */
export function actorLine(what: "start" | "end", actor: Actor | "AUTO", at: Moment, today: string): string {
  if (actor === "AUTO") return `انتهى تلقائيًا بعد ${EXCUSE_LIMITS.maxDays} يومًا`;
  const { name, male } = actorWords(actor);
  const verb = what === "start" ? (male ? "بدأه" : "بدأته") : male ? "أنهاه" : "أنهته";
  return `${verb} ${name} · ${momentLabel(at, today)}`;
}

/** The message under the time field. other: the moment it must come after (OVERLAP: her last excuse's end; BEFORE_START: this one's start). */
export function momentErrorText(e: MomentError, you: G, other: Moment | null, today: string): string {
  const pick = you === "MALE" ? "اختر" : "اختاري";
  if (e === "NO_TIME") return `${pick} الوقت أولًا`;
  if (e === "FUTURE") return "هذا الوقت لم يأتِ بعد";
  if (e === "TOO_EARLY") return `${pick} اليوم أو أمس`;
  const at = other ? momentLabel(other, today) : "";
  if (e === "OVERLAP") return `انتهى العذر السابق ${at}، ف${pick} وقتًا بعده`;
  return `بدأ العذر ${at}، ف${pick} وقتًا بعده`;
}

// ---------- fixed wording (review page v3; ids as there) ----------

// A — her settings («رفيق الحفظ»)
export const EXCUSE_TITLE = "أيام العذر"; // A1, F1
export const EXCUSE_SWITCH = "تفعيل أيام العذر"; // A2, G2
export const EXCUSE_SETTINGS_SELF = "يظهر زرّ فوق جدول المتابعة تبدئين به العذر وتنهينه. ولا يرى أحدٌ أنكِ معذورة."; // A3
export const EXCUSE_SWITCH_OFF_NOTE = "إيقاف هذا المفتاح يُنهي العذر الحالي الآن، ويبقى ما مضى محسوبًا كما كان."; // A4

// B — an item's setting
export const ITEM_EXCUSE_FIELD = "في أيام العذر"; // B1
export const ITEM_EXCUSE_OPTIONS = { NONE: "يُحسب كالمعتاد", SKIP: "لا يُحسب", ALT: "له بديل" } as const; // B2
export const ITEM_EXCUSE_HINT = {
  SKIP: "يُرفع من حساب اليوم ما دام العذر قائمًا.", // B3
  ALT: "يظهر البديل مكانه في أيام العذر، ويُحسب بدرجة البند نفسها.", // B4
} as const;
export const ITEM_EXCUSE_ALT_LABEL = "البديل"; // B5
export const ITEM_EXCUSE_ALT_PLACEHOLDER = "مثال: 100 تسبيحة"; // B5
/** B8: «في أيام العذر: لا يُحسب» / «في أيام العذر: 100 تسبيحة». null: as usual (no line). */
export const itemExcuseLine = (mode: "NONE" | "SKIP" | "ALT", alt: string | null | undefined): string | null =>
  mode === "SKIP" ? `${ITEM_EXCUSE_FIELD}: ${ITEM_EXCUSE_OPTIONS.SKIP}` : mode === "ALT" && alt ? `${ITEM_EXCUSE_FIELD}: ${alt}` : null;

// C — the button, the line and the panels
export const EXCUSE_START = "بدء العذر"; // C1
export const EXCUSE_START_TITLE = "متى بدأ العذر؟"; // C2
export const EXCUSE_WHEN = { NOW: "الآن", EARLIER: "في وقت سابق" } as const; // C3
export const EXCUSE_DAYS = { TODAY: "اليوم", YESTERDAY: "أمس" } as const; // C3
export const EXCUSE_CONFIRM = "تأكيد"; // C5
export const EXCUSE_CANCEL = "إلغاء"; // C5
export const EXCUSE_END = "انتهى العذر"; // C7
export const EXCUSE_END_TITLE = "متى انتهى العذر؟"; // C10
export const EXCUSE_ENDED = "انتهى العذر، وعادت البنود كما كانت ✓"; // C12
/** C13, to her (self) or to an adult on a girl's page. */
export const excuseAutoEnded = (self: boolean) =>
  `مرّ ${EXCUSE_LIMITS.maxDays} يومًا على بدء العذر، فأُنهي تلقائيًا وعادت البنود كما كانت. ${self ? "يمكنكِ بدؤه من جديد متى احتجتِ." : "يمكن بدؤه من جديد عند الحاجة."}`;
export const EXCUSE_OK = "حسنًا"; // C13

// D — in the tracker
/** D1: under an alternative, «بدل «صلاة العصر»». */
export const excuseInsteadOf = (title: string) => `بدل «${title}»`;
export const EXCUSE_SKIP_TODAY = "لا يُحسب اليوم"; // D2
export const EXCUSE_DAY = "يوم عذر"; // D3
export const EXCUSE_SUMMARY_NOTE = "في أيام العذر يُحسب البديل مكان بنده، وتُرفع البنود التي لا تُحسب."; // D4
