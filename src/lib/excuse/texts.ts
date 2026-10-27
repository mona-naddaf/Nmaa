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
