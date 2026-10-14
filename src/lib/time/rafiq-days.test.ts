// «رفيق الحفظ» shows dates on her own day (her browser's time zone), never
// the UTC one: the «منذ» date of a flagged word and when a home passage was
// started/finished. The server sends the whole timestamp; ShownDay turns it
// into her day in the browser. Course values ("YYYY-MM-DD") pass unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shownDay } from "./shown-day";
import { mergeActiveMistakes } from "@/lib/students/mistakes";
import { buildHomeLogView } from "@/lib/home-log/data";

const AT_2130 = new Date("2026-10-14T21:30:00Z"); // 00:30 on the 15th in Riyadh, 22:30 on the 14th in Rabat
const AT_2330 = new Date("2026-10-14T23:30:00Z"); // 02:30 on the 15th in Riyadh, 00:30 on the 15th in Rabat

/** Runs fn as if in a browser set to this time zone. */
function inBrowserZone<T>(tz: string, fn: () => T): T {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

const iso = (d: Date) => d.toISOString();

test("«منذ» on a flagged word: her own day, not the UTC one", () => {
  const rows = [{ surahNumber: 114, ayah: 1, wordPosition: 2, wordText: "بِرَبِّ", type: "PRONUNCIATION" as const, flaggedAt: AT_2130, source: "SESSION" as const }];
  const [m] = mergeActiveMistakes(rows, [114], iso);
  assert.equal(m.firstFlagged, AT_2130.toISOString());
  assert.equal(inBrowserZone("Asia/Riyadh", () => shownDay(m.firstFlagged, null)), "2026-10-15");
  assert.equal(inBrowserZone("Africa/Casablanca", () => shownDay(m.firstFlagged, null)), "2026-10-14");
  assert.equal(inBrowserZone("Pacific/Auckland", () => shownDay(m.firstFlagged, null)), "2026-10-15");
  // the old UTC day would have said the 14th in Riyadh
  assert.equal(AT_2130.toISOString().slice(0, 10), "2026-10-14");
});

test("home passages: started/finished on her own day", () => {
  const row = (id: string, createdAt: Date, finishedAt: Date | null) => ({
    id, surahNumber: 112, fromAyah: 1, toAyah: 4, targetListen: 1, targetRepeat: 1, targetRecite: 1, createdAt, finishedAt, finishedBy: finishedAt ? ("STUDENT" as const) : null, assignmentId: null,
  });
  const view = buildHomeLogView({
    activeRows: [row("a", AT_2130, null)],
    pastRows: [row("b", AT_2130, AT_2330)],
    grouped: [],
    latest: [],
    lastTapDay: null,
    dayOf: iso,
  });
  const past = view.past[0];
  assert.equal(inBrowserZone("Asia/Riyadh", () => shownDay(view.active[0].createdAt, null)), "2026-10-15");
  assert.equal(inBrowserZone("Africa/Casablanca", () => shownDay(past.createdAt, null)), "2026-10-14");
  assert.equal(inBrowserZone("Africa/Casablanca", () => shownDay(past.finishedAt!, null)), "2026-10-15");
  assert.equal(inBrowserZone("America/New_York", () => shownDay(past.finishedAt!, null)), "2026-10-14");
});

test("course dates stay as they are (a stored day is shown unchanged, in any zone)", () => {
  for (const tz of ["Asia/Riyadh", "Pacific/Kiritimati", "America/Los_Angeles"]) {
    assert.equal(inBrowserZone(tz, () => shownDay("2026-10-14", null)), "2026-10-14");
    assert.equal(shownDay("2026-10-14", tz), "2026-10-14");
  }
  // a course timestamp with the course's zone
  assert.equal(shownDay(AT_2130.toISOString(), "Asia/Riyadh"), "2026-10-15");
  assert.equal(shownDay(AT_2130.toISOString(), "Africa/Casablanca"), "2026-10-14");
  // the course's server-side default is unchanged: UTC slice when no dayOf is given
  const [m] = mergeActiveMistakes([{ surahNumber: 1, ayah: 1, wordPosition: 1, wordText: "x", type: "PRONUNCIATION" as const, flaggedAt: AT_2130 }], [1]);
  assert.equal(m.firstFlagged, "2026-10-14");
});
