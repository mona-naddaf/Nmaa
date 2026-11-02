import { test } from "node:test";
import assert from "node:assert/strict";
import { courseExcuseDesc } from "./texts";

// G3: addressed by the supervisor's recorded gender; feminine when none is recorded.

test("G3: a man gets the masculine wording; a woman or no gender recorded the feminine", () => {
  assert.ok(courseExcuseDesc("MALE").includes("والمشرف فقط") && courseExcuseDesc("MALE").includes("إلا إن فعّلتَ"));
  for (const g of ["FEMALE", null] as const) {
    assert.ok(courseExcuseDesc(g).includes("والمشرفة فقط") && courseExcuseDesc(g).includes("إلا إن فعّلتِ"));
  }
});
