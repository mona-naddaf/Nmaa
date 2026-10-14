"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useTimeZone } from "@/lib/time/TimeZoneProvider";
import { zoneToday } from "@/lib/time/zone";

export { dayOfInstant, shownDay } from "@/lib/time/shown-day";

// "Today" in the browser: on course pages, today in the course's time zone
// (TimeZoneProvider); in «رفيق الحفظ», which has no provider, her own civil
// day in the browser's time zone. Never the server's (UTC on Vercel). null
// during server rendering and hydration; callers render a placeholder until
// then.

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// re-check once a minute and whenever the tab comes back, so a page left
// open overnight rolls over to the new day
function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}

export function useToday(): string | null {
  const tz = useTimeZone();
  const snapshot = useCallback(() => (tz ? zoneToday(tz) : localToday()), [tz]);
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
