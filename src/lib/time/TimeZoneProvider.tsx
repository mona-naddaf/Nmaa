"use client";

import { createContext, useContext } from "react";

// The course's time zone for client components (lib/time/zone.ts). Course
// pages (staff, student, parent) are wrapped in it; «رفيق الحفظ» is not, so
// there useTimeZone() is null and days follow her own browser.

const TimeZoneContext = createContext<string | null>(null);

export function TimeZoneProvider({ timeZone, children }: { timeZone: string; children: React.ReactNode }) {
  return <TimeZoneContext.Provider value={timeZone}>{children}</TimeZoneContext.Provider>;
}

export function useTimeZone(): string | null {
  return useContext(TimeZoneContext);
}
