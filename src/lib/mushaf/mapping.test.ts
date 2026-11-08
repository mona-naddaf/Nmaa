import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import quranText from "@/lib/quran-data/quran-uthmani.json";
import { splitAyah } from "@/lib/quran-data/words";
import { AYAH_COUNT } from "@/lib/quran-data";
import { juzOf } from "@/lib/quran-data/juz";
import { entryWords, MUSHAF_PAGES, pageHeader, pagesOf, parseKey, type MushafPage } from "./page";

// The Mushaf pages (public/mushaf/v2, built from QUL's KFGQPC V2 layout and
// QPC V2 glyphs) against our word positions (words.ts), over the whole
// Quran: every word of every ayah is on the pages exactly once, in order.

const SURAHS = (quranText as { surahs: string[][] }).surahs;
const PAGES: MushafPage[] = Array.from({ length: MUSHAF_PAGES }, (_, i) =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "mushaf", "v2", `p${i + 1}.json`), "utf8")),
);

test("the Mushaf pages: 604 files, 15 lines each (8 on pages 1–2), every line known", () => {
  assert.equal(PAGES.length, 604);
  for (const page of PAGES) {
    assert.equal(page.lines.length, page.p <= 2 ? 8 : 15, `page ${page.p}`);
    for (const line of page.lines) {
      if (line.t === "a") assert.ok(line.w.length > 0 && line.w.every(([k, g]) => k && g), `page ${page.p}`);
      else assert.ok(line.s >= 1 && line.s <= 114 && (line.t === "s" || (line.s !== 1 && line.s !== 9)), `page ${page.p}`);
    }
  }
});

test("every word of the Quran is on the pages once, in order, as words.ts counts it", () => {
  // all keys, in page and line order
  const keys = PAGES.flatMap((p) => p.lines.flatMap((l) => (l.t === "a" ? l.w.flatMap((e) => (e[0].endsWith(":e") ? [e[0]] : entryWords(e))) : [])));
  const expected: string[] = [];
  let words = 0;
  for (let s = 1; s <= 114; s++) {
    for (let a = 1; a <= SURAHS[s - 1].length; a++) {
      const split = splitAyah(s, a, SURAHS[s - 1][a - 1]).words;
      words += split.length;
      for (const w of split) expected.push(`${s}:${a}:${w.position}`);
      expected.push(`${s}:${a}:e`);
    }
  }
  assert.equal(keys.length, expected.length);
  for (let i = 0; i < keys.length; i++) assert.equal(keys[i], expected[i], `entry ${i}`);
  assert.equal(keys.filter((k) => k.endsWith(":e")).length, 6236);
  assert.ok(words > 77000);
});

test("the glyphs that stand for two of our words are exactly the hand-listed ones", () => {
  const spans = PAGES.flatMap((p) => p.lines.flatMap((l) => (l.t === "a" ? l.w.filter((e) => e[2] === 2).map((e) => e[0]) : [])));
  assert.deepEqual(spans, ["37:130:3"]);
});

test("every entry is one glyph (a word with its pause or sajdah mark: up to three), and no glyph is used twice on a page", () => {
  let withMark = 0;
  for (const page of PAGES) {
    const seen = new Set<string>();
    for (const line of page.lines)
      if (line.t === "a")
        for (const [key, g] of line.w) {
          const chars = [...g];
          assert.ok(chars.length === 1 || (chars.length <= 3 && !key.endsWith(":e")), `${key} on page ${page.p}`);
          if (chars.length > 1) withMark++;
          for (const c of chars) {
            assert.ok(c.trim() && !seen.has(c), `${key}: glyph repeated on page ${page.p}`);
            seen.add(c);
          }
        }
  }
  // the pause marks of the Madinah Mushaf drawn with their word
  assert.ok(withMark > 4000);
});

test("pagesOf (the bundled page map) gives exactly the pages each ayah's words are on", () => {
  const on = new Map<string, Set<number>>();
  for (const page of PAGES)
    for (const line of page.lines)
      if (line.t === "a")
        for (const [k] of line.w) {
          const ayah = k.split(":").slice(0, 2).join(":");
          if (!on.has(ayah)) on.set(ayah, new Set());
          on.get(ayah)!.add(page.p);
        }
  for (let s = 1; s <= 114; s++) {
    for (let a = 1; a <= AYAH_COUNT[s]; a++) {
      const pages = [...on.get(`${s}:${a}`)!].sort((x, y) => x - y);
      assert.deepEqual(pagesOf(s, a, a), pages, `${s}:${a}`);
    }
  }
});

test("a surah's name and basmala come right before its first ayah", () => {
  const all = PAGES.flatMap((p) => p.lines);
  for (let i = 0; i < all.length; i++) {
    const line = all[i];
    if (line.t !== "a") continue;
    const first = parseKey(line.w[0][0]);
    if (first.ayah !== 1 || first.word !== 1) continue;
    const s = first.surah;
    if (s === 1 || s === 9) assert.deepEqual(all[i - 1], { t: "s", s }, `surah ${s}`);
    else {
      assert.deepEqual(all[i - 1], { t: "b", s }, `surah ${s}`);
      assert.deepEqual(all[i - 2], { t: "s", s }, `surah ${s}`);
    }
  }
});

test("the page header: the juz runs 1 to 30 in order, each starting on its printed page", () => {
  const juz = PAGES.map((p) => pageHeader(p).juz);
  for (let i = 1; i < juz.length; i++) assert.ok(juz[i] === juz[i - 1] || juz[i] === juz[i - 1] + 1, `page ${i + 1}`);
  assert.equal(juz[0], 1);
  assert.equal(juz[603], 30);
  // the Madinah Mushaf: juz 2 opens on page 22, juz 30 on page 582
  assert.equal(juz.indexOf(2) + 1, 22);
  assert.equal(juz.indexOf(30) + 1, 582);
  assert.equal(juzOf(2, 142), 2);
});
