import { isAsr, isMethod, type PrayerLocation } from "./times";

// A stored place (Course / RafiqUser prayer* columns) as a PrayerLocation,
// or null when none is set. Client-safe.

export interface PlaceColumns {
  prayerCityKey: string | null;
  prayerPlace: string | null;
  prayerLat: number | null;
  prayerLng: number | null;
  prayerMethod: string | null;
  prayerAsr: string | null;
}

export const PLACE_SELECT = {
  prayerCityKey: true,
  prayerPlace: true,
  prayerLat: true,
  prayerLng: true,
  prayerMethod: true,
  prayerAsr: true,
} as const;

export function locationOf(row: PlaceColumns | null | undefined): PrayerLocation | null {
  if (!row || row.prayerLat === null || row.prayerLng === null || !row.prayerPlace || !isMethod(row.prayerMethod) || !isAsr(row.prayerAsr)) return null;
  return { key: row.prayerCityKey, name: row.prayerPlace, lat: row.prayerLat, lng: row.prayerLng, method: row.prayerMethod, asr: row.prayerAsr };
}

/** A PrayerLocation (or null: none) as the columns to store. */
export function placeColumns(loc: PrayerLocation | null): PlaceColumns {
  return loc
    ? { prayerCityKey: loc.key, prayerPlace: loc.name, prayerLat: loc.lat, prayerLng: loc.lng, prayerMethod: loc.method, prayerAsr: loc.asr }
    : { prayerCityKey: null, prayerPlace: null, prayerLat: null, prayerLng: null, prayerMethod: null, prayerAsr: null };
}
