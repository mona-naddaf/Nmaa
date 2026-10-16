import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, type SummaryRow } from "./summary";

const r = (kind: SummaryRow["kind"], code: string, letterText: string | null = null): SummaryRow => ({ kind, code, letterText });

test("a makhraj counts by its letter; the ghunna by the khayshum", () => {
  const s = summarize([r("MAKHRAJ", "hafat_lisan", "ضَ"), r("MAKHRAJ", "hafat_lisan", "ضِّ"), r("MAKHRAJ", "khayshum", "نّ"), r("MAKHRAJ", "", null)]);
  assert.deepEqual(
    s.map((g) => [g.label, g.count]),
    [
      ["مخرج الضاد", 2],
      ["مخرج (عام)", 1],
      ["مخرج الغنّة (الخيشوم)", 1],
    ],
  );
  // a tatweel unit counts as the letter it stands for
  assert.equal(summarize([r("MAKHRAJ", "jawf", "ـٰ")])[0].label, "مخرج الألف");
});

test("a sifa by name, general ones together", () => {
  const s = summarize([r("SIFA", "istitala"), r("SIFA", ""), r("SIFA", ""), r("SIFA", "istitala"), r("SIFA", "qalqala")]);
  assert.deepEqual(
    s.map((g) => [g.label, g.count]),
    [
      ["الاستطالة", 2],
      ["صفة (عامّة)", 2],
      ["القلقلة", 1],
    ],
  );
});

test("a rule by its group, the same group on letters and gaps as one, with its rules inside", () => {
  const s = summarize([
    r("HUKM", "noon.ikhfa"),
    r("HUKM", "gap_noon.ikhfa"),
    r("HUKM", "gap_noon.iqlab"),
    r("HUKM", "qalqala.kubra"),
    r("HUKM", ""),
  ]);
  assert.deepEqual(s[0], {
    key: "H:النون الساكنة والتنوين",
    label: "النون الساكنة والتنوين",
    count: 3,
    parts: [
      { label: "إخفاء", count: 2 },
      { label: "إقلاب", count: 1 },
    ],
  });
  assert.deepEqual(
    s.slice(1).map((g) => [g.label, g.count, g.parts.length]),
    [
      ["القلقلة", 1, 1],
      ["حكم تجويد (عام)", 1, 0],
    ],
  );
  assert.deepEqual(summarize([]), []);
});
