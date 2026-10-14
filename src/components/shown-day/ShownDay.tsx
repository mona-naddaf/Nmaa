"use client";

import { shownDay, useToday } from "@/lib/calendar/useToday";
import { useTimeZone } from "@/lib/time/TimeZoneProvider";

/**
 * A date as the viewer should read it: a stored day ("YYYY-MM-DD", course
 * pages) as it is; a timestamp (ISO, «رفيق الحفظ») as the course's day, or —
 * no course zone — her own browser's day, known once the page is in her
 * browser («…» until then).
 */
export function ShownDay({ value }: { value: string }) {
  const tz = useTimeZone();
  const inBrowser = useToday() !== null;
  const plain = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return <>{plain || tz || inBrowser ? shownDay(value, tz) : "…"}</>;
}
