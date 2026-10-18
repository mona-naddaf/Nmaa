import { test } from "node:test";
import assert from "node:assert/strict";
import { readTiming, type TimingFields } from "./timing-input";

const base: TimingFields = { mode: "CLOCK", start: "", end: "", prayer: "FAJR", before: false, offset: "0", duration: "" };
const read = (f: Partial<TimingFields>) => readTiming({ ...base, ...f });

test("time editor: no time, a clock time, a prayer anchor", () => {
  assert.deepEqual(read({ mode: "NONE" }), { timing: null });
  assert.deepEqual(read({ start: "07:30" }), { timing: { kind: "CLOCK", startMin: 450, durationMin: null } });
  assert.deepEqual(read({ start: "07:30", end: "08:00" }), { timing: { kind: "CLOCK", startMin: 450, durationMin: 30 } });
  assert.deepEqual(read({ mode: "PRAYER", prayer: "MAGHRIB", before: true, offset: "15", duration: "20" }), {
    timing: { kind: "PRAYER", prayer: "MAGHRIB", offsetMin: -15, durationMin: 20 },
  });
});

test("time editor: each problem names the field to go to", () => {
  assert.equal((read({}) as { field: string }).field, "start");
  assert.equal((read({ start: "07:30", end: "07:32" }) as { field: string }).field, "end");
  assert.equal((read({ mode: "PRAYER", offset: "200" }) as { field: string }).field, "offset");
  assert.equal((read({ mode: "PRAYER", before: true, offset: "0" }) as { field: string }).field, "offset");
  assert.equal((read({ mode: "PRAYER", offset: "5", duration: "3" }) as { field: string }).field, "duration");
  // the messages stay the ones the editor always showed
  assert.equal((read({}) as { error: string }).error, "يُرجى اختيار وقت البداية");
});
