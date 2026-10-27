"use server";

import { revalidatePath } from "next/cache";
import { resolveSubject } from "@/lib/rafiq/subject";
import { safeTimeZone } from "@/lib/time/zone";
import { endExcuse, nowIn, ownExcuse, setPause, settleExpired, startExcuse, type ExcuseResult, type MomentInput } from "@/lib/excuse/rafiq-data";

// «أيام العذر» on her own «جدول المتابعة» («رفيق الحفظ»): «بدء العذر»,
// «انتهى العذر», and closing one that passed its 15 days. zone: her
// browser's time zone (her days), as «المحصّلات». A woman's own excuse only;
// nobody else can reach it.

// a stale page (the switch turned off meanwhile)
const OFF = { error: "أيام العذر غير مفعّلة — يمكن تفعيلها من الإعدادات" };

// her tracker, and (a pause) her 🔥 and goal on «صفحتي»
function refresh() {
  revalidatePath("/rafiq", "layout");
}

async function own(subjectId: unknown) {
  const user = await resolveSubject(subjectId ?? null, "record");
  if ("error" in user) return user;
  if (!user.self || user.kind !== "ADULT" || !(await ownExcuse(user.id)).on) return OFF;
  return user;
}

// pause: «إيقاف الحفظ أيضًا» (C4)
export async function startExcuseAction(input: { at: MomentInput; zone: unknown; pause?: boolean; subjectId?: string }): Promise<ExcuseResult> {
  const user = await own(input?.subjectId);
  if ("error" in user) return user;
  const r = await startExcuse(user.id, input?.at, safeTimeZone(typeof input?.zone === "string" ? input.zone : null), { you: user.gender, adultId: null }, input?.pause === true);
  if (!r.error) refresh();
  return r;
}

export async function endExcuseAction(input: { at: MomentInput; zone: unknown; subjectId?: string }): Promise<ExcuseResult> {
  const user = await own(input?.subjectId);
  if ("error" in user) return user;
  const r = await endExcuse(user.id, input?.at, safeTimeZone(typeof input?.zone === "string" ? input.zone : null), { you: user.gender, adultId: null });
  if (!r.error) refresh();
  return r;
}

/** «إيقاف الحفظ أيضًا» / «استئناف الحفظ» while her excuse lasts (C9). */
export async function setPauseAction(input: { on: boolean; zone: unknown; subjectId?: string }): Promise<ExcuseResult> {
  const user = await own(input?.subjectId);
  if ("error" in user) return user;
  const r = await setPause(user.id, input?.on === true, safeTimeZone(typeof input?.zone === "string" ? input.zone : null));
  if (!r.error) refresh();
  return r;
}

/** Her page found her excuse past its 15 days: it ends at its cap (the notice shows once, where this ran). */
export async function settleExcuseAction(input: { zone: unknown; subjectId?: string }): Promise<ExcuseResult> {
  const user = await resolveSubject(input?.subjectId ?? null, "record");
  if ("error" in user) return user;
  if (!user.self || user.kind !== "ADULT" || !(await ownExcuse(user.id)).show) return {};
  const tz = safeTimeZone(typeof input?.zone === "string" ? input.zone : null);
  const autoEnded = await settleExpired(user.id, nowIn(tz), tz);
  if (autoEnded) refresh();
  return { autoEnded };
}
