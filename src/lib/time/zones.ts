// The zones offered in «التوقيت» (settings): the common Arab / Middle East
// ones first, with their Arabic city names; any other IANA zone through the
// search. Client-safe.

import { zoneOffsetLabel } from "./zone";

export const COMMON_ZONES: { id: string; city: string }[] = [
  { id: "Asia/Riyadh", city: "الرياض" },
  { id: "Asia/Damascus", city: "دمشق" },
  { id: "Asia/Amman", city: "عمّان" },
  { id: "Asia/Beirut", city: "بيروت" },
  { id: "Africa/Cairo", city: "القاهرة" },
  { id: "Europe/Istanbul", city: "إسطنبول" },
  { id: "Asia/Dubai", city: "دبي" },
  { id: "Asia/Baghdad", city: "بغداد" },
  { id: "Asia/Qatar", city: "الدوحة" },
  { id: "Asia/Kuwait", city: "الكويت" },
  { id: "Asia/Muscat", city: "مسقط" },
  // Morocco's IANA zone is named after Casablanca; the capital's name is shown
  { id: "Africa/Casablanca", city: "الرباط" },
  { id: "Africa/Algiers", city: "الجزائر" },
  { id: "Africa/Tunis", city: "تونس" },
];

const CITY = new Map(COMMON_ZONES.map((z) => [z.id, z.city]));

/** The zone's Arabic name: the city for a common zone, else the zone's Arabic description (e.g. «توقيت وسط أوروبا»). */
export function zoneName(id: string, now: Date = new Date()): string {
  const city = CITY.get(id);
  if (city) return city;
  try {
    const part = new Intl.DateTimeFormat("ar", { timeZone: id, timeZoneName: "longGeneric" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName");
    return part ? part.value : id;
  } catch {
    return id;
  }
}

/** «الرياض (‎+03:00)» — the offset is isolated so it reads left to right. */
export function zoneLabel(id: string, now: Date = new Date()): string {
  return `${zoneName(id, now)} (⁦${zoneOffsetLabel(id, now)}⁩)`;
}

/** Every IANA zone this runtime knows, for the search. */
export function allZoneIds(): string[] {
  const ids = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return [...new Set([...COMMON_ZONES.map((z) => z.id), ...ids])];
}
