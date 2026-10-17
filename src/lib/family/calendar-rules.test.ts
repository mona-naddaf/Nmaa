import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, fromHijri } from "@/lib/calendar/hijri";
import {
  CHILD_EVENTS_PER_10_MIN,
  CHILD_EVENTS_PER_DAY,
  childMayAddEvent,
  cleanFamilyEvent,
  decideFamilyCalendar,
  eventByline,
  nextFamilyItem,
  type CalendarAction,
  type CalendarActor,
} from "./calendar-rules";

const founder: CalendarActor = { kind: "ADULT", id: "mona", canEdit: true };
const viewOnly: CalendarActor = { kind: "ADULT", id: "huda", canEdit: false };
const child: CalendarActor = { kind: "CHILD", id: "laila", canEdit: false };
// a child is never an editor, even if a caller got it wrong
const childFlagged: CalendarActor = { kind: "CHILD", id: "laila", canEdit: true };

test("decideFamilyCalendar: every row", () => {
  const own = { createdById: "laila" };
  const adults = { createdById: "mona" };
  const departed = { createdById: null };
  const rows: [CalendarActor | null, CalendarAction, { createdById: string | null } | undefined, boolean][] = [
    // seeing and adding: everyone in the family
    [founder, "view", undefined, true],
    [viewOnly, "view", undefined, true],
    [child, "view", undefined, true],
    [founder, "create", undefined, true],
    [viewOnly, "create", undefined, true],
    [child, "create", undefined, true],
    // her own event
    [child, "edit", own, true],
    [{ ...viewOnly, id: "laila" }, "edit", own, true],
    // someone else's
    [child, "edit", adults, false],
    [childFlagged, "edit", adults, false],
    [viewOnly, "edit", adults, false],
    [viewOnly, "edit", own, false],
    [founder, "edit", own, true],
    [{ ...viewOnly, canEdit: true }, "edit", own, true],
    // a departed member's: editors only
    [child, "edit", departed, false],
    [viewOnly, "edit", departed, false],
    [founder, "edit", departed, true],
    // no event given: nothing to own
    [child, "edit", undefined, false],
    // occasions and moon sighting: editors only
    [founder, "occasions", undefined, true],
    [founder, "adjust", undefined, true],
    [viewOnly, "occasions", undefined, false],
    [viewOnly, "adjust", undefined, false],
    [child, "occasions", undefined, false],
    [childFlagged, "adjust", undefined, false],
    // not in the family
    [null, "view", undefined, false],
    [null, "create", undefined, false],
    [null, "edit", own, false],
  ];
  for (const [actor, action, event, want] of rows) {
    assert.equal(decideFamilyCalendar(actor, action, event), want, `${actor?.kind ?? "outsider"}/${actor?.canEdit} ${action} ${JSON.stringify(event)}`);
  }
});

test("cleanFamilyEvent: title, description, date and its range", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  const ok = cleanFamilyEvent({ title: "  زيارة الجدة ", date: "2026-11-01", description: "" }, now);
  assert.deepEqual(ok, { title: "زيارة الجدة", date: new Date("2026-11-01T00:00:00Z"), description: null });
  assert.ok("error" in cleanFamilyEvent({ title: "   ", date: "2026-11-01", description: "" }, now));
  assert.ok("error" in cleanFamilyEvent({ title: "x".repeat(81), date: "2026-11-01", description: "" }, now));
  assert.ok(!("error" in cleanFamilyEvent({ title: "x".repeat(80), date: "2026-11-01", description: "y".repeat(500) }, now)));
  assert.ok("error" in cleanFamilyEvent({ title: "x", date: "2026-11-01", description: "y".repeat(501) }, now));
  assert.ok("error" in cleanFamilyEvent({ title: "x", date: "2026-02-30", description: "" }, now));
  assert.ok("error" in cleanFamilyEvent({ title: "x", date: "1/11/2026", description: "" }, now));
  // a year back and two ahead, with a day of slack
  assert.ok(!("error" in cleanFamilyEvent({ title: "x", date: "2025-10-17", description: "" }, now)));
  assert.ok("error" in cleanFamilyEvent({ title: "x", date: "2025-10-01", description: "" }, now));
  assert.ok(!("error" in cleanFamilyEvent({ title: "x", date: "2028-10-17", description: "" }, now)));
  assert.ok("error" in cleanFamilyEvent({ title: "x", date: "2028-11-01", description: "" }, now));
  // junk input never throws
  assert.ok("error" in cleanFamilyEvent(null as never, now));
});

test("childMayAddEvent: 10 per 10 minutes, 30 per day", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60 * 1000);
  assert.equal(childMayAddEvent([], now), true);
  const nine = Array.from({ length: CHILD_EVENTS_PER_10_MIN - 1 }, (_, i) => ago(i % 9));
  assert.equal(childMayAddEvent(nine, now), true);
  assert.equal(childMayAddEvent([...nine, ago(1)], now), false);
  // older than ten minutes don't count towards the short window
  assert.equal(childMayAddEvent([...nine, ago(11)], now), true);
  const day = Array.from({ length: CHILD_EVENTS_PER_DAY }, (_, i) => ago(20 + i * 30));
  assert.equal(childMayAddEvent(day, now), false);
  // a day later, all forgotten
  assert.equal(childMayAddEvent(day.map((d) => new Date(d.getTime() - 24 * 60 * 60 * 1000)), now), true);
});

test("eventByline: gendered, her own, and a former member", () => {
  const members = [
    { id: "ahmad", name: "أحمد", gender: "MALE" as const },
    { id: "laila", name: "ليلى", gender: "FEMALE" as const },
  ];
  const huda = { id: "huda", gender: "FEMALE" as const };
  const omar = { id: "omar", gender: "MALE" as const };
  assert.equal(eventByline("ahmad", members, huda), "أضافها أحمد");
  assert.equal(eventByline("laila", members, omar), "أضافتها ليلى");
  assert.equal(eventByline("huda", members, huda), "أضفتِها");
  assert.equal(eventByline("omar", members, omar), "أضفتَها");
  assert.equal(eventByline("gone", members, huda), "أضافها عضو سابق");
  assert.equal(eventByline(null, members, huda), "أضافها عضو سابق");
});

test("nextFamilyItem: the nearest of events and occasions, today/tomorrow, nothing past 30 days", () => {
  const ramadan = fromHijri(1448, 9, 1)!;
  const ev = (id: string, date: string, title = id) => ({ id, title, description: null, date, editable: false });
  // the occasion itself: today, tomorrow, in 3 days
  assert.deepEqual(nextFamilyItem(ramadan, [], [], []), { title: "بداية شهر رمضان", date: ramadan, when: "اليوم" });
  assert.equal(nextFamilyItem(addDays(ramadan, -1), [], [], [])?.when, "غدًا");
  assert.equal(nextFamilyItem(addDays(ramadan, -3), [], [], [])?.when, "بعد 3 أيام");
  // a family event before it wins
  assert.deepEqual(nextFamilyItem(addDays(ramadan, -3), [], [], [ev("e1", addDays(ramadan, -2), "زيارة")]), { title: "زيارة", date: addDays(ramadan, -2), when: "غدًا" });
  // a past event is ignored
  assert.equal(nextFamilyItem(addDays(ramadan, -3), [], [], [ev("old", addDays(ramadan, -10))])?.title, "بداية شهر رمضان");
  // the family's moon-sighting adjustment moves it
  assert.equal(nextFamilyItem(addDays(ramadan, -1), [], [{ occasion: "RAMADAN_START", hijriYear: 1448, offsetDays: 1 }], [])?.when, "بعد يومين");
  // 30 days ahead is shown, 31 is not
  assert.equal(nextFamilyItem(addDays(ramadan, -30), [], [], [])?.when, "بعد 30 يومًا");
  assert.equal(nextFamilyItem(addDays(ramadan, -31), [], [], []), null);
  // an optional occasion only once the family turned it on (mid-Sha'ban is 14–15 days before Ramadan)
  const shaban = addDays(ramadan, -20);
  assert.equal(nextFamilyItem(shaban, [], [], [])?.title, "بداية شهر رمضان");
  assert.equal(nextFamilyItem(shaban, ["MID_SHABAN"], [], [])?.title !== "بداية شهر رمضان", true);
});
