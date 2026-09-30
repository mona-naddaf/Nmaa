"use client";

import { useSyncExternalStore } from "react";

// "Today" for the calendar is the viewer's own civil day, in the browser's
// time zone — never the server's (which is UTC on Vercel). null during
// server rendering and hydration; callers render a placeholder until then.

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
  return useSyncExternalStore(subscribe, localToday, () => null);
}
