import { test } from "node:test";
import assert from "node:assert/strict";
import quranText from "@/lib/quran-data/quran-uthmani.json";
import { splitAyah } from "@/lib/quran-data/words";
import { getAyahPageEntries } from "@/lib/quran-data";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canChange,
  canHighlight,
  cleanColorName,
  covers,
  MAX_HIGHLIGHTS,
  overlaps,
  paletteOf,
  rangeOf,
  rangeProblem,
  snapToGlyphs,
  TWO_WORD_GLYPHS,
  type QuranFacts,
} from "./rules";
import { DEFAULT_HIGHLIGHT_COLOR, HIGHLIGHT_COLOR_KEYS, isHighlightColor } from "./colors";
import { highlightTexts } from "./texts";
import { MUSHAF_PAGES, type MushafPage } from "@/lib/mushaf/page";

const SURAHS = (quranText as { surahs: string[][] }).surahs;
const FACTS: QuranFacts = {
  wordCount: (s, a) => (SURAHS[s - 1]?.[a - 1] ? splitAyah(s, a, SURAHS[s - 1][a - 1]).words.length : 0),
  pageOf: (s, a) => getAyahPageEntries(s)?.[a - 1]?.[1] ?? null,
};
const r = (surahNumber: number, fromAyah: number, fromWord: number, toAyah: number, toWord: number) => ({ surahNumber, fromAyah, fromWord, toAyah, toWord });

test("rangeOf: either word may be tapped first; the same word twice is one word", () => {
  assert.deepEqual(rangeOf(2, { ayah: 5, word: 3 }, { ayah: 4, word: 7 }), r(2, 4, 7, 5, 3));
  assert.deepEqual(rangeOf(2, { ayah: 4, word: 7 }, { ayah: 5, word: 3 }), r(2, 4, 7, 5, 3));
  assert.deepEqual(rangeOf(2, { ayah: 4, word: 2 }, { ayah: 4, word: 2 }), r(2, 4, 2, 4, 2));
});

test("snapToGlyphs: a boundary inside «إِلْ يَاسِينَ» (37:130, words 3–4) widens to the whole glyph", () => {
  assert.deepEqual(snapToGlyphs(r(37, 130, 4, 130, 4)), r(37, 130, 3, 130, 4));
  assert.deepEqual(snapToGlyphs(r(37, 130, 3, 130, 3)), r(37, 130, 3, 130, 4));
  assert.deepEqual(snapToGlyphs(r(37, 129, 2, 130, 3)), r(37, 129, 2, 130, 4));
  assert.deepEqual(snapToGlyphs(r(37, 130, 4, 131, 2)), r(37, 130, 3, 131, 2));
  // elsewhere nothing moves
  assert.deepEqual(snapToGlyphs(r(37, 130, 1, 130, 2)), r(37, 130, 1, 130, 2));
  assert.deepEqual(snapToGlyphs(r(2, 130, 4, 130, 4)), r(2, 130, 4, 130, 4));
});

test("TWO_WORD_GLYPHS is exactly what the Mushaf pages draw as one glyph for two words", () => {
  const spans: string[] = [];
  for (let p = 1; p <= MUSHAF_PAGES; p++) {
    const page: MushafPage = JSON.parse(readFileSync(join(process.cwd(), "public", "mushaf", "v2", `p${p}.json`), "utf8"));
    for (const l of page.lines) if (l.t === "a") for (const e of l.w) if (e[2] === 2) spans.push(e[0]);
  }
  assert.deepEqual(spans, [...TWO_WORD_GLYPHS]);
});

test("rangeProblem: valid stretches, and each limit", () => {
  // one word, a verse end into the next verse, three ayat on one page
  assert.equal(rangeProblem(r(2, 5, 1, 5, 1), FACTS, []), null);
  assert.equal(rangeProblem(r(2, 4, 8, 5, 2), FACTS, []), null);
  assert.equal(rangeProblem(r(2, 2, 1, 4, 3), FACTS, []), null);
  // four ayat
  assert.equal(rangeProblem(r(2, 2, 1, 5, 1), FACTS, []), "ayat");
  // 2:5 is the last ayah of page 2, 2:6 opens page 3
  assert.equal(FACTS.pageOf(2, 5), 2);
  assert.equal(FACTS.pageOf(2, 6), 3);
  assert.equal(rangeProblem(r(2, 5, 1, 6, 1), FACTS, []), "page");
  // words that don't exist, reversed, not integers, a surah that doesn't exist
  assert.equal(rangeProblem(r(1, 1, 5, 1, 5), FACTS, []), "invalid");
  assert.equal(rangeProblem(r(2, 5, 3, 5, 1), FACTS, []), "invalid");
  assert.equal(rangeProblem(r(2, 5, 1.5, 5, 2), FACTS, []), "invalid");
  assert.equal(rangeProblem(r(115, 1, 1, 1, 1), FACTS, []), "invalid");
  assert.equal(rangeProblem(r(2, 0, 1, 1, 1), FACTS, []), "invalid");
  // overlap with an existing one (sharing one word is enough), and the cap
  assert.equal(rangeProblem(r(2, 3, 1, 3, 4), FACTS, [r(2, 3, 4, 4, 1)]), "overlap");
  assert.equal(rangeProblem(r(2, 3, 1, 3, 3), FACTS, [r(2, 3, 4, 4, 1)]), null);
  assert.equal(rangeProblem(r(2, 3, 1, 3, 3), FACTS, [], MAX_HIGHLIGHTS), "cap");
  assert.equal(rangeProblem(r(2, 3, 1, 3, 3), FACTS, [], MAX_HIGHLIGHTS - 1), null);
});

test("the Madinah Mushaf: no ayah runs onto the next page (the one-page rule relies on it)", () => {
  for (let s = 1; s <= 114; s++) for (const e of getAyahPageEntries(s)!) assert.equal(e[1], e[2], `surah ${s}`);
});

test("overlaps and covers", () => {
  assert.ok(overlaps(r(2, 3, 1, 3, 4), r(2, 3, 4, 3, 9)));
  assert.ok(overlaps(r(2, 3, 1, 4, 2), r(2, 3, 5, 3, 6)));
  assert.ok(!overlaps(r(2, 3, 1, 3, 3), r(2, 3, 4, 3, 9)));
  assert.ok(!overlaps(r(2, 3, 1, 3, 3), r(3, 3, 1, 3, 3)));
  assert.ok(covers(r(2, 3, 5, 4, 2), 2, 4, 1));
  assert.ok(covers(r(2, 3, 5, 4, 2), 2, 3, 5));
  assert.ok(!covers(r(2, 3, 5, 4, 2), 2, 3, 4));
  assert.ok(!covers(r(2, 3, 5, 4, 2), 2, 4, 3));
});

test("paletteOf: the default first, always; then hers in order; unknown keys ignored", () => {
  assert.deepEqual(paletteOf([]), [{ color: DEFAULT_HIGHLIGHT_COLOR, name: null }]);
  assert.deepEqual(
    paletteOf([
      { color: "pink", name: null, sortOrder: 2 },
      { color: "sky", name: "نهايات الآيات", sortOrder: 1 },
      { color: "yellow", name: "انتقالات", sortOrder: 0 },
      { color: "red", name: null, sortOrder: 3 },
    ]),
    [
      { color: "yellow", name: "انتقالات" },
      { color: "sky", name: "نهايات الآيات" },
      { color: "pink", name: null },
    ],
  );
});

test("cleanColorName: trimmed, at most 30 characters, empty = no name", () => {
  assert.deepEqual(cleanColorName("  نهايات   الآيات "), { name: "نهايات الآيات" });
  assert.deepEqual(cleanColorName("   "), { name: null });
  assert.deepEqual(cleanColorName(null), { name: null });
  assert.deepEqual(cleanColorName("ا".repeat(30)), { name: "ا".repeat(30) });
  assert.equal(cleanColorName("ا".repeat(31)), null);
  assert.equal(cleanColorName(5), null);
});

test("colours: six fixed keys, the default among them, no raw colour accepted", () => {
  assert.equal(HIGHLIGHT_COLOR_KEYS.length, 6);
  assert.ok(isHighlightColor(DEFAULT_HIGHLIGHT_COLOR));
  assert.ok(!isHighlightColor("#ff0000"));
  assert.ok(!isHighlightColor("constructor"));
});

test("who may change a highlight", () => {
  const own = { byAdult: false };
  const adults = { byAdult: true };
  assert.ok(canChange("self", own));
  assert.ok(canChange("child", own));
  assert.ok(!canChange("child", adults), "a child can't change an adult's highlight");
  assert.ok(canChange("adult-edit", own) && canChange("adult-edit", adults));
  assert.ok(!canChange("adult-view", own) && !canChange("adult-view", adults));
  assert.ok(canHighlight("self") && canHighlight("child") && canHighlight("adult-edit"));
  assert.ok(!canHighlight("adult-view"));
});

test("texts: both genders differ where they address the reader, and every problem has a message", () => {
  const f = highlightTexts("FEMALE");
  const m = highlightTexts("MALE");
  assert.notEqual(f.hintLast, m.hintLast);
  assert.ok(f.hintLast.startsWith("اضغطي") && m.hintLast.startsWith("اضغط "));
  for (const k of ["invalid", "ayat", "page", "overlap", "cap"] as const) assert.ok(f.problem[k] && m.problem[k]);
  assert.equal(f.lockedBy(null), "🔒 من أحد البالغين");
});

test("privacy: nothing that builds what others see (the family dashboard, sharing) reads highlights", async () => {
  const { readdirSync } = await import("node:fs");
  const dir = join(process.cwd(), "src", "lib", "family");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
    const src = readFileSync(join(dir, f), "utf8");
    assert.ok(!/rafiqHighlight\b|RafiqHighlight\b|highlightsIn|loadHighlights/.test(src), `${f} reads highlights`);
  }
});

test("HIGHLIGHT_EMAILS: unset or empty = nobody, «*» = everyone, else the listed emails (any case)", async () => {
  const { highlightAllowed } = await import("./enabled");
  const before = process.env.HIGHLIGHT_EMAILS;
  try {
    delete process.env.HIGHLIGHT_EMAILS;
    assert.equal(highlightAllowed("a@b.c"), false);
    process.env.HIGHLIGHT_EMAILS = "";
    assert.equal(highlightAllowed("a@b.c"), false);
    process.env.HIGHLIGHT_EMAILS = "Mona@Example.com, x@y.z";
    assert.equal(highlightAllowed("mona@example.com"), true);
    assert.equal(highlightAllowed(" MONA@example.com "), true);
    assert.equal(highlightAllowed("other@example.com"), false);
    assert.equal(highlightAllowed(null), false);
    process.env.HIGHLIGHT_EMAILS = "*";
    assert.equal(highlightAllowed("anyone@example.com"), true);
  } finally {
    if (before === undefined) delete process.env.HIGHLIGHT_EMAILS;
    else process.env.HIGHLIGHT_EMAILS = before;
  }
});
