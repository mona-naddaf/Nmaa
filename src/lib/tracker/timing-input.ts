// What the time editor's fields (ScheduleEditor) make: a timing, or what's
// wrong and in which field. Pure; the editor shows the message under the
// fields, and «رفيق الحفظ» / «العائلة» also send her to that field when she
// presses «حفظ الوقت».

import { timeFromInputs } from "./agenda";
import { OFFSET_MAX, type Timing } from "./schedule";
import type { Prayer } from "@/lib/prayer/times";

export type TimingMode = "NONE" | "CLOCK" | "PRAYER";
export type TimingField = "start" | "end" | "offset" | "duration";
export type TimingProblem = { error: string; field: TimingField };

export type TimingFields = {
  mode: TimingMode;
  start: string;
  end: string;
  prayer: Prayer;
  before: boolean;
  offset: string;
  duration: string;
};

export function readTiming(f: TimingFields): { timing: Timing } | TimingProblem {
  if (f.mode === "NONE") return { timing: null };
  if (f.mode === "CLOCK") {
    if (!f.start) return { error: "يُرجى اختيار وقت البداية", field: "start" };
    const t = timeFromInputs(f.start, f.end);
    // a start was picked, so anything wrong now is about the end
    if ("error" in t) return { error: t.error, field: "end" };
    return { timing: { kind: "CLOCK", ...t } };
  }
  const mins = Number(f.offset);
  const dur = f.duration.trim();
  const d = dur ? Number(dur) : null;
  if (!Number.isInteger(mins) || mins < 0 || mins > OFFSET_MAX) return { error: `يُرجى إدخال دقائق من 0 إلى ${OFFSET_MAX}`, field: "offset" };
  if (f.before && mins === 0) return { error: "يُرجى تحديد كم دقيقة قبل الصلاة", field: "offset" };
  if (d !== null && (!Number.isInteger(d) || d < 5 || d > 720)) return { error: "يُرجى أن تكون المدة من 5 إلى 720 دقيقة", field: "duration" };
  return { timing: { kind: "PRAYER", prayer: f.prayer, offsetMin: f.before ? -mins : mins, durationMin: d } };
}
