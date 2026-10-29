"use server";

import { revalidatePath } from "next/cache";
import { resolveSubject } from "@/lib/rafiq/subject";
import { safeTimeZone } from "@/lib/time/zone";
import { endExcuse, nowIn, setPause, settleExpired, startExcuse, type ExcuseResult, type MomentInput } from "@/lib/excuse/rafiq-data";
import { subjectExcuse } from "@/lib/excuse/subject";

// «أيام العذر» on «جدول المتابعة»: «بدء العذر», «انتهى العذر», and closing
// one that passed its 15 days. zone: the browser's time zone (her days), as
// «المحصّلات». A woman's own excuse (nobody else can reach it), or a girl's
// in «العائلة»: she herself and the adults checked in her list
// (subjectId: her id on an adult's page).

// a stale page (the switch turned off meanwhile)
const OFF = { error: "أيام العذر غير مفعّلة — يمكن تفعيلها من الإعدادات" };

// her tracker, and (a pause) her 🔥 and goal on «صفحتي» — hers, and a girl's own and on the adults' pages
function refresh() {
  revalidatePath("/rafiq", "layout");
  revalidatePath("/family", "layout");
}

/** Whose excuse it is, and who presses (by), when the one asking may start and end it. */
async function own(subjectId: unknown) {
  const user = await resolveSubject(subjectId ?? null, "view");
  if ("error" in user) return user;
  const ex = await subjectExcuse(user);
  if (!ex.on) return OFF;
  return { id: user.id, by: { you: ex.you, adultId: ex.adultId } };
}

// pause: «إيقاف الحفظ أيضًا» (C4)
export async function startExcuseAction(input: { at: MomentInput; zone: unknown; pause?: boolean; subjectId?: string }): Promise<ExcuseResult> {
  const user = await own(input?.subjectId);
  if ("error" in user) return user;
  const r = await startExcuse(user.id, input?.at, safeTimeZone(typeof input?.zone === "string" ? input.zone : null), user.by, input?.pause === true);
  if (!r.error) refresh();
  return r;
}

export async function endExcuseAction(input: { at: MomentInput; zone: unknown; subjectId?: string }): Promise<ExcuseResult> {
  const user = await own(input?.subjectId);
  if ("error" in user) return user;
  const r = await endExcuse(user.id, input?.at, safeTimeZone(typeof input?.zone === "string" ? input.zone : null), user.by);
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
  const user = await resolveSubject(input?.subjectId ?? null, "view");
  if ("error" in user) return user;
  if (!(await subjectExcuse(user)).show) return {};
  const tz = safeTimeZone(typeof input?.zone === "string" ? input.zone : null);
  const autoEnded = await settleExpired(user.id, nowIn(tz), tz);
  if (autoEnded) refresh();
  return { autoEnded };
}
