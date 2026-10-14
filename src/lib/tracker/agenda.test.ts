import { test } from "node:test";
import assert from "node:assert/strict";
import {
  byAgendaOrder,
  clockLabel,
  clockValue,
  layoutLanes,
  minuteOfDay,
  minutesLabel,
  moveId,
  nowAndNext,
  nowKey,
  parseClock,
  timeFromInputs,
  timeLabel,
  timelineRange,
  validateOrder,
  validateTime,
  shiftEnd,
  timelineSegments,
  timelineY,
  type Timed,
} from "./agenda";

const RIYADH = "Asia/Riyadh";
const RABAT = "Africa/Casablanca";
// 2026-10-14 21:30 UTC = 00:30 on the 15th in Riyadh, 22:30 on the 14th in Rabat
const AT_2130 = new Date("2026-10-14T21:30:00Z");
// 23:30 UTC = 02:30 on the 15th in Riyadh, 00:30 on the 15th in Rabat
const AT_2330 = new Date("2026-10-14T23:30:00Z");

test("times: validation, inputs and labels", () => {
  assert.deepEqual(validateTime({ startMin: 450, durationMin: 30 }), { startMin: 450, durationMin: 30 });
  assert.deepEqual(validateTime({ startMin: 0 }), { startMin: 0, durationMin: null });
  for (const bad of [null, {}, { startMin: -1 }, { startMin: 1440 }, { startMin: 1.5 }, { startMin: 60, durationMin: 4 }, { startMin: 60, durationMin: 721 }, "7:30"]) {
    assert.equal(validateTime(bad), null, JSON.stringify(bad));
  }
  assert.equal(parseClock("07:30"), 450);
  assert.equal(parseClock("24:00"), null);
  assert.equal(clockValue(450), "07:30");
  assert.equal(clockValue(1440 + 30), "00:30");
  assert.deepEqual(timeFromInputs("07:30", "08:15"), { startMin: 450, durationMin: 45 });
  assert.deepEqual(timeFromInputs("23:30", "00:30"), { startMin: 1410, durationMin: 60 }); // past midnight
  assert.deepEqual(timeFromInputs("05:00", ""), { startMin: 300, durationMin: null });
  assert.ok("error" in timeFromInputs("", "08:00"));
  assert.ok("error" in timeFromInputs("07:00", "07:02"));
  assert.ok("error" in timeFromInputs("07:00", "20:00"));
  assert.equal(shiftEnd("05:00", "05:30", "06:00"), "06:30"); // the end follows the start
  assert.equal(shiftEnd("23:30", "00:30", "23:45"), "00:45");
  assert.equal(shiftEnd("05:00", "", "06:00"), "");
  assert.equal(clockLabel(0), "12:00 ص");
  assert.equal(clockLabel(450), "7:30 ص");
  assert.equal(clockLabel(12 * 60 + 5), "12:05 م");
  assert.equal(clockLabel(1410 + 60), "12:30 ص");
  assert.equal(timeLabel({ startMin: 1410, durationMin: 60 }), "11:30 م – 12:30 ص");
  assert.equal(minutesLabel(1), "دقيقة");
  assert.equal(minutesLabel(2), "دقيقتان");
  assert.equal(minutesLabel(7), "7 دقائق");
  assert.equal(minutesLabel(25), "25 دقيقة");
  assert.equal(minutesLabel(60), "ساعة");
  assert.equal(minutesLabel(140), "ساعتان و20 دقيقة");
});

test("now: the minute and day follow the course zone around midnight (Riyadh and Rabat)", () => {
  assert.equal(minuteOfDay(RIYADH, AT_2130), 30);
  assert.equal(nowKey(RIYADH, AT_2130), "2026-10-15|30");
  assert.equal(minuteOfDay(RABAT, AT_2130), 22 * 60 + 30);
  assert.equal(nowKey(RABAT, AT_2130), "2026-10-14|1350");
  assert.equal(nowKey(RIYADH, AT_2330), "2026-10-15|150");
  assert.equal(nowKey(RABAT, AT_2330), "2026-10-15|30");
});

test("«الآن» and «التالي», including an item that runs past midnight", () => {
  const items: Timed[] = [
    { id: "fajr-wird", time: { startMin: 5 * 60, durationMin: 30 } },
    { id: "review", time: { startMin: 20 * 60, durationMin: 60 } },
    { id: "night", time: { startMin: 23 * 60, durationMin: 120 } }, // 23:00–01:00
    { id: "point", time: { startMin: 21 * 60 + 30, durationMin: null } },
  ];
  // Rabat at 22:30 on the 14th: nothing running ("point" lasted 21:30–21:45), next is "night" in 30 min
  let s = nowAndNext(items, minuteOfDay(RABAT, AT_2130));
  assert.deepEqual(s.current.map((i) => i.id), []);
  assert.equal(s.next?.id, "night");
  assert.equal(s.inMin, 30);
  // 20:20: "review" running, 40 minutes left, next is "point" in 70
  s = nowAndNext(items, 20 * 60 + 20);
  assert.deepEqual(s.current.map((i) => i.id), ["review"]);
  assert.equal(s.leftMin, 40);
  assert.equal(s.next?.id, "point");
  // Riyadh at 00:30 on the 15th: yesterday's "night" (shifted by −1440) is still running, 30 min left
  const carried = items.filter((i) => i.time.startMin + (i.time.durationMin ?? 0) > 1440).map((i) => ({ ...i, time: { ...i.time, startMin: i.time.startMin - 1440 } }));
  s = nowAndNext([...items, ...carried], minuteOfDay(RIYADH, AT_2130));
  assert.deepEqual(s.current.map((i) => i.id), ["night"]);
  assert.equal(s.leftMin, 30);
  assert.equal(s.next?.id, "fajr-wird");
  assert.equal(s.inMin, 5 * 60 - 30);
});

test("timeline: overlapping items side by side; the range extends past midnight", () => {
  const items = [
    { id: "a", time: { startMin: 600, durationMin: 60 } },
    { id: "b", time: { startMin: 630, durationMin: 60 } },
    { id: "c", time: { startMin: 640, durationMin: 10 } },
    { id: "d", time: { startMin: 720, durationMin: 30 } },
    { id: "e", time: { startMin: 1410, durationMin: 60 } },
  ];
  const lanes = Object.fromEntries(layoutLanes(items).map((l) => [l.item.id, [l.lane, l.lanes]]));
  assert.deepEqual(lanes.a, [0, 3]);
  assert.deepEqual(lanes.b, [1, 3]);
  assert.deepEqual(lanes.c, [2, 3]);
  assert.deepEqual(lanes.d, [0, 1]); // starts after a/b/c ended... b ends at 690 < 720
  assert.deepEqual(lanes.e, [0, 1]);
  assert.deepEqual(timelineRange(items, null), { fromMin: 600, toMin: 1500 });
  assert.deepEqual(timelineRange([{ id: "x", time: { startMin: 600, durationMin: 30 } }], 300), { fromMin: 300, toMin: 660 });
});

test("timeline: long empty gaps fold; busy hours and «now» stay to scale", () => {
  const items: Timed[] = [
    { id: "dawn", time: { startMin: 5 * 60, durationMin: 30 } },
    { id: "night", time: { startMin: 23 * 60 + 30, durationMin: 60 } },
  ];
  // 05:00 (the first item's hour) … 06:00 to scale; a fold until 15:00; now 16:00 ±1h; a fold; 23:00 … 01:00 next day
  const segs = timelineSegments(items, 16 * 60);
  assert.deepEqual(segs, [
    { fromMin: 300, toMin: 360, folded: false },
    { fromMin: 360, toMin: 900, folded: true },
    { fromMin: 900, toMin: 1020, folded: false },
    { fromMin: 1020, toMin: 1380, folded: true },
    { fromMin: 1380, toMin: 1500, folded: false },
  ]);
  // the y positions grow monotonically and a fold takes its fixed height
  assert.equal(timelineY(segs, 300, 1, 40), 0);
  assert.equal(timelineY(segs, 360, 1, 40), 60);
  assert.equal(timelineY(segs, 900, 1, 40), 100);
  assert.equal(timelineY(segs, 960, 1, 40), 160);
  assert.equal(timelineY(segs, 1500, 1, 40), 60 + 40 + 120 + 40 + 120);
  // a busy day stays one to-scale piece
  const busy: Timed[] = [
    { id: "a", time: { startMin: 600, durationMin: 60 } },
    { id: "b", time: { startMin: 720, durationMin: 60 } },
  ];
  assert.deepEqual(timelineSegments(busy, null), [{ fromMin: 600, toMin: 780, folded: false }]);
});

test("order: personal first, then template order, then creation; moves and validation", () => {
  const items = [
    { id: "a", sortOrder: 0, createdAt: "2026-10-01T00:00:00Z" },
    { id: "b", sortOrder: 0, createdAt: "2026-09-01T00:00:00Z" },
    { id: "c", sortOrder: 1, createdAt: "2026-10-05T00:00:00Z" },
  ];
  // placed items first; not-yet-placed ones (0) after them, by creation
  assert.deepEqual(byAgendaOrder(items).map((i) => i.id), ["c", "b", "a"]);
  assert.deepEqual(byAgendaOrder([...items, { id: "d", sortOrder: 2, createdAt: "2026-08-01T00:00:00Z" }]).map((i) => i.id), ["c", "d", "b", "a"]);
  // nobody reordered: creation order, exactly as the tracker showed before
  assert.deepEqual(byAgendaOrder(items.map((i) => ({ ...i, sortOrder: 0 }))).map((i) => i.id), ["b", "a", "c"]);
  assert.deepEqual(byAgendaOrder(items.map((i) => ({ ...i, position: i.id === "a" ? 0 : i.id === "c" ? 1 : 2 }))).map((i) => i.id), ["a", "c", "b"]);
  assert.deepEqual(moveId(["a", "b", "c"], "c", -1), ["a", "c", "b"]);
  assert.deepEqual(moveId(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
  const allowed = new Set(["a", "b", "c"]);
  assert.deepEqual(validateOrder(["c", "a"], allowed), ["c", "a"]);
  assert.equal(validateOrder(["a", "a"], allowed), null);
  assert.equal(validateOrder(["a", "x"], allowed), null);
  assert.equal(validateOrder([], allowed), null);
  assert.equal(validateOrder("a", allowed), null);
});
