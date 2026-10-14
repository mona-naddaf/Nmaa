import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDaysISO,
  backdatedAt,
  isValidTimeZone,
  safeTimeZone,
  zoneDateOnly,
  zoneDayOf,
  zoneDayRange,
  zoneDayStart,
  zoneOffsetLabel,
  zoneToday,
} from "./zone";
import { zoneLabel, zoneName } from "./zones";

// Simulated instants around midnight. On 2026-10-14:
//   21:30 UTC = 00:30 on the 15th in Riyadh (+3), 22:30 on the 14th in Rabat (+1), 10:30 on the 15th in Auckland (+13)
//   23:30 UTC = 02:30 on the 15th in Riyadh,     00:30 on the 15th in Rabat,      12:30 on the 15th in Auckland
const AT_2130 = new Date("2026-10-14T21:30:00Z");
const AT_2330 = new Date("2026-10-14T23:30:00Z");
const RIYADH = "Asia/Riyadh";
const RABAT = "Africa/Casablanca";
const AUCKLAND = "Pacific/Auckland";

test("today follows the zone around midnight", () => {
  assert.equal(zoneToday(RIYADH, AT_2130), "2026-10-15");
  assert.equal(zoneToday(RIYADH, AT_2330), "2026-10-15");
  assert.equal(zoneToday(RABAT, AT_2130), "2026-10-14");
  assert.equal(zoneToday(RABAT, AT_2330), "2026-10-15");
  assert.equal(zoneToday(AUCKLAND, AT_2130), "2026-10-15");
  assert.equal(zoneToday(AUCKLAND, AT_2330), "2026-10-15");
  assert.equal(zoneToday("UTC", AT_2330), "2026-10-14");
  assert.equal(zoneDateOnly(RIYADH, AT_2130).toISOString(), "2026-10-15T00:00:00.000Z");
});

test("a day's start and range in the zone", () => {
  assert.equal(zoneDayStart(RIYADH, "2026-10-15").toISOString(), "2026-10-14T21:00:00.000Z");
  assert.equal(zoneDayStart(RABAT, "2026-10-15").toISOString(), "2026-10-14T23:00:00.000Z");
  assert.equal(zoneDayStart(AUCKLAND, "2026-10-15").toISOString(), "2026-10-14T11:00:00.000Z");
  const r = zoneDayRange(RIYADH, "2026-10-01", "2026-10-15");
  assert.equal(r.gte.toISOString(), "2026-09-30T21:00:00.000Z");
  assert.equal(r.lt.toISOString(), "2026-10-15T21:00:00.000Z");
  // the boundary instants belong to the right days
  assert.equal(zoneDayOf(RIYADH, new Date(r.lt.getTime() - 1)), "2026-10-15");
  assert.equal(zoneDayOf(RIYADH, r.lt), "2026-10-16");
});

test("a day whose midnight is skipped by a clock change starts at the first real moment", () => {
  // Beirut: 2026-03-29 00:00 (+02) jumps to 01:00 (+03), i.e. at 22:00 UTC on the 28th
  assert.equal(zoneDayStart("Asia/Beirut", "2026-03-29").toISOString(), "2026-03-28T22:00:00.000Z");
  assert.equal(zoneDayOf("Asia/Beirut", new Date("2026-03-28T21:59:59Z")), "2026-03-28");
  // and a day with an extra hour (Beirut, back from +03 to +02 at 2026-10-25 00:00)
  const start = zoneDayStart("Asia/Beirut", "2026-10-25");
  assert.equal(zoneDayOf("Asia/Beirut", start), "2026-10-25");
  assert.equal(zoneDayOf("Asia/Beirut", new Date(start.getTime() - 1)), "2026-10-24");
});

test("offsets and labels", () => {
  assert.equal(zoneOffsetLabel(RIYADH, AT_2130), "+03:00");
  assert.equal(zoneOffsetLabel(RABAT, AT_2130), "+01:00");
  assert.equal(zoneOffsetLabel(AUCKLAND, AT_2130), "+13:00");
  assert.equal(zoneOffsetLabel("America/St_Johns", AT_2130), "-02:30");
  assert.equal(zoneName(RIYADH), "الرياض");
  assert.equal(zoneName(RABAT), "الرباط");
  assert.ok(zoneLabel(RIYADH, AT_2130).startsWith("الرياض (") && zoneLabel(RIYADH, AT_2130).includes("+03:00"));
});

test("only real IANA zones are accepted; anything else falls back to Riyadh", () => {
  for (const tz of [RIYADH, RABAT, AUCKLAND, "Asia/Qatar", "Asia/Kuwait", "Asia/Muscat", "UTC"]) assert.ok(isValidTimeZone(tz), tz);
  for (const tz of ["", "Riyadh", "Mars/Olympus", "Asia/Riyadh; DROP", 5, null]) assert.equal(isValidTimeZone(tz), false, String(tz));
  assert.equal(safeTimeZone("nope"), RIYADH);
  assert.equal(safeTimeZone(null), RIYADH);
  assert.equal(safeTimeZone(RABAT), RABAT);
});

test("a backdated entry: noon UTC within ±11 h, local noon further out — always on its day", () => {
  assert.equal(backdatedAt(RIYADH, "2026-10-10").toISOString(), "2026-10-10T12:00:00.000Z");
  assert.equal(backdatedAt(RABAT, "2026-10-10").toISOString(), "2026-10-10T12:00:00.000Z");
  assert.equal(backdatedAt("America/New_York", "2026-10-10").toISOString(), "2026-10-10T12:00:00.000Z");
  // Auckland (+13): noon UTC would be 01:00 the next day there
  assert.equal(backdatedAt(AUCKLAND, "2026-10-10").toISOString(), "2026-10-09T23:00:00.000Z");
  assert.equal(backdatedAt("Pacific/Kiritimati", "2026-10-10").toISOString(), "2026-10-09T22:00:00.000Z");
  for (const tz of [RIYADH, RABAT, AUCKLAND, "Pacific/Kiritimati", "Pacific/Pago_Pago", "Pacific/Tongatapu", "America/Los_Angeles"]) {
    for (const day of ["2026-01-15", "2026-03-29", "2026-10-25", "2026-12-31"]) {
      assert.equal(zoneDayOf(tz, backdatedAt(tz, day)), day, `${tz} ${day}`);
    }
  }
});

test("Riyadh in normal hours (03:00–20:59 UTC): exactly the old UTC days", () => {
  // the old site-wide helpers, as they were
  const oldToday = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const oldDayOf = (d: Date) => d.toISOString().slice(0, 10);
  for (let day = 0; day < 400; day += 7) {
    for (let minutes = 3 * 60; minutes < 21 * 60; minutes += 37) {
      const now = new Date(Date.UTC(2026, 0, 1 + day, 0, minutes));
      assert.equal(zoneDateOnly(RIYADH, now).getTime(), oldToday(now).getTime(), now.toISOString());
      assert.equal(zoneDayOf(RIYADH, now), oldDayOf(now), now.toISOString());
    }
  }
  assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
});
