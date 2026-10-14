import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultMethod, prayerMinutes, validateLocation, type MethodKey, type Prayer, type PrayerLocation } from "./times";
import { CITIES, cityByKey } from "./cities";
import { isValidTimeZone } from "@/lib/time/zone";

// Reference times from an independent implementation (AlAdhan's public
// timings API, fetched once for these cases; same methods and angles,
// Shafi'i Asr), in each city's local time. Ours must agree within 3 minutes
// (both round to the minute; at high latitude the Asr formulas differ by up
// to 3). Rabat is compared in UTC: the reference shows Morocco at UTC+0 in
// late 2026, while the server's time-zone data (the source of truth: UTC+1
// all year except Ramadan) says UTC+1; that's the offset, not the prayer
// calculation. See «Pending» in README.md.
const REF: Record<string, Record<string, string>> = {
  "riyadh 2026-10-14": { FAJR: "04:33", SUNRISE: "05:51", DHUHR: "11:39", ASR: "15:00", MAGHRIB: "17:28", ISHA: "18:58" },
  // Ramadan 1448: Isha 120 minutes after Maghrib
  "riyadh 2027-02-20": { FAJR: "05:05", SUNRISE: "06:24", DHUHR: "12:07", ASR: "15:23", MAGHRIB: "17:50", ISHA: "19:50" },
  "riyadh 2026-06-21": { FAJR: "03:33", SUNRISE: "05:05", DHUHR: "11:55", ASR: "15:16", MAGHRIB: "18:45", ISHA: "20:15" },
  "makkah 2026-10-14": { FAJR: "05:00", SUNRISE: "06:16", DHUHR: "12:07", ASR: "15:28", MAGHRIB: "17:57", ISHA: "19:27" },
  "makkah 2027-02-20": { FAJR: "05:32", SUNRISE: "06:48", DHUHR: "12:34", ASR: "15:53", MAGHRIB: "18:21", ISHA: "20:21" },
  // Egypt: summer time on 1 May, standard time again on 31 October
  "cairo 2026-10-14": { FAJR: "05:30", SUNRISE: "06:56", DHUHR: "12:41", ASR: "15:58", MAGHRIB: "18:26", ISHA: "19:43" },
  "cairo 2026-05-01": { FAJR: "04:37", SUNRISE: "06:12", DHUHR: "12:52", ASR: "16:28", MAGHRIB: "19:32", ISHA: "20:57" },
  "cairo 2026-10-31": { FAJR: "04:40", SUNRISE: "06:08", DHUHR: "11:39", ASR: "14:46", MAGHRIB: "17:09", ISHA: "18:28" },
  "damascus 2026-10-14": { FAJR: "05:16", SUNRISE: "06:39", DHUHR: "12:21", ASR: "15:36", MAGHRIB: "18:03", ISHA: "19:21" },
  "damascus 2027-02-20": { FAJR: "05:51", SUNRISE: "07:14", DHUHR: "12:49", ASR: "15:57", MAGHRIB: "18:24", ISHA: "19:42" },
  "istanbul 2026-10-14": { FAJR: "05:43", SUNRISE: "07:07", DHUHR: "12:55", ASR: "16:01", MAGHRIB: "18:32", ISHA: "19:51" },
  "istanbul 2026-06-21": { FAJR: "03:24", SUNRISE: "05:25", DHUHR: "13:11", ASR: "17:11", MAGHRIB: "20:47", ISHA: "22:38" },
  "rabat 2026-10-14": { FAJR: "05:04", SUNRISE: "06:32", DHUHR: "12:13", ASR: "15:28", MAGHRIB: "17:55", ISHA: "19:13" },
  "rabat 2027-02-20": { FAJR: "05:39", SUNRISE: "07:07", DHUHR: "12:41", ASR: "15:49", MAGHRIB: "18:16", ISHA: "19:34" },
  // London either side of the clock change on 25 October
  "london 2026-10-24": { FAJR: "05:48", SUNRISE: "07:40", DHUHR: "12:45", ASR: "15:19", MAGHRIB: "17:49", ISHA: "19:34" },
  "london 2026-10-26": { FAJR: "04:51", SUNRISE: "06:43", DHUHR: "11:44", ASR: "14:16", MAGHRIB: "16:45", ISHA: "18:31" },
  "london 2027-03-01": { FAJR: "04:55", SUNRISE: "06:46", DHUHR: "12:13", ASR: "15:02", MAGHRIB: "17:40", ISHA: "19:25" },
};
const METHOD: Record<string, MethodKey> = { riyadh: "UMM_AL_QURA", makkah: "UMM_AL_QURA", cairo: "EGYPTIAN", damascus: "MWL", istanbul: "TURKEY", rabat: "MOROCCO", london: "MWL" };

const loc = (key: string, method = METHOD[key], asr: "SHAFI" | "HANAFI" = "SHAFI"): PrayerLocation => {
  const c = cityByKey(key)!;
  return { key, name: c.name, lat: c.lat, lng: c.lng, method, asr };
};
const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));

test("prayer times agree with an independent reference (within 3 minutes)", () => {
  const worst: string[] = [];
  for (const [k, ref] of Object.entries(REF)) {
    const [city, day] = k.split(" ");
    const ours = prayerMinutes(loc(city), day, city === "rabat" ? "UTC" : cityByKey(city)!.tz);
    for (const [p, hm] of Object.entries(ref)) {
      const diff = Math.abs(ours[p as Prayer] - mins(hm));
      if (diff > 3) worst.push(`${k} ${p}: ours ${ours[p as Prayer]} vs ${mins(hm)}`);
    }
  }
  assert.deepEqual(worst, []);
});

test("Ramadan: Umm al-Qura Isha moves from 90 to 120 minutes after Maghrib", () => {
  const before = prayerMinutes(loc("riyadh"), "2027-02-05", "Asia/Riyadh"); // Sha'ban
  const during = prayerMinutes(loc("riyadh"), "2027-02-20", "Asia/Riyadh"); // Ramadan
  assert.equal(before.ISHA - before.MAGHRIB, 90);
  assert.equal(during.ISHA - during.MAGHRIB, 120);
  // other methods aren't touched by Ramadan
  const cairo = prayerMinutes(loc("cairo"), "2027-02-20", "Africa/Cairo");
  assert.ok(cairo.ISHA - cairo.MAGHRIB < 100);
});

test("Hanafi Asr is later than Shafi'i", () => {
  const s = prayerMinutes(loc("istanbul", "TURKEY", "SHAFI"), "2026-10-14", "Europe/Istanbul");
  const h = prayerMinutes(loc("istanbul", "TURKEY", "HANAFI"), "2026-10-14", "Europe/Istanbul");
  assert.ok(h.ASR - s.ASR > 30);
  assert.equal(h.DHUHR, s.DHUHR);
});

test("the same day's times in the browser's zone (no course zone) match the course-zone ones", () => {
  const prev = process.env.TZ;
  process.env.TZ = "Asia/Riyadh";
  try {
    assert.deepEqual(prayerMinutes(loc("riyadh"), "2026-10-14", null), prayerMinutes(loc("riyadh"), "2026-10-14", "Asia/Riyadh"));
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
});

test("near midnight: a late summer Isha and an early Fajr at high latitude", () => {
  const stockholm = { key: "stockholm", name: "ستوكهولم", lat: 59.3293, lng: 18.0686, method: "MWL" as const, asr: "SHAFI" as const };
  const t = prayerMinutes(stockholm, "2026-06-21", "Europe/Stockholm");
  // all six exist and are in order; Isha late in the evening (or after midnight), Fajr very early
  assert.ok(t.FAJR < t.SUNRISE && t.SUNRISE < t.DHUHR && t.DHUHR < t.ASR && t.ASR < t.MAGHRIB && t.MAGHRIB < t.ISHA);
  assert.ok(t.ISHA > 22 * 60, `Isha ${t.ISHA}`);
  assert.ok(t.FAJR < 3 * 60, `Fajr ${t.FAJR}`);
});

test("cities: valid zones, unique keys, default methods by country; locations are validated", () => {
  assert.equal(new Set(CITIES.map((c) => c.key)).size, CITIES.length);
  assert.ok(CITIES.length >= 150, `${CITIES.length} cities`);
  for (const c of CITIES) assert.ok(isValidTimeZone(c.tz), `${c.key} ${c.tz}`);
  assert.equal(defaultMethod("SA"), "UMM_AL_QURA");
  assert.equal(defaultMethod("MA"), "MOROCCO");
  assert.equal(defaultMethod("GB"), "MWL");
  assert.ok(validateLocation({ key: null, name: "قريتي", lat: 24.1, lng: 46.2, method: "MWL", asr: "SHAFI" }));
  for (const bad of [null, { name: "", lat: 1, lng: 1, method: "MWL", asr: "SHAFI" }, { name: "x", lat: 91, lng: 1, method: "MWL", asr: "SHAFI" }, { name: "x", lat: 1, lng: 1, method: "NOPE", asr: "SHAFI" }]) {
    assert.equal(validateLocation(bad), null);
  }
});
