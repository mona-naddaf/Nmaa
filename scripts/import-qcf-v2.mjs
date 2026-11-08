// Builds the Mushaf page files (Madinah Mushaf, KFGQPC V2 1421H layout, 604
// pages) that the «صفحة المصحف» view draws with the QCF V2 page fonts.
//
//   node --no-warnings scripts/import-qcf-v2.mjs <layout.db> <glyphs.db>
//
// Source: QUL (qul.tarteel.ai, Tarteel), downloaded with a QUL account into
// data/raw/mushaf/ (git-ignored):
//  - layout.db: "KFGQPC V2 layout (1421H print)", page by page
//    (resources/mushaf-layout/10): pages(page_number, line_number,
//    line_type, is_centered, first_word_id, last_word_id, surah_number)
//  - glyphs.db: "QPC V2 Glyph – word by word" (resources/quran-script/61):
//    words(id, location, surah, ayah, word, text); each ayah's last entry is
//    its ayah-end glyph (its number)
// Only read as data (node:sqlite, read-only).
//
// Writes public/mushaf/v2/p{n}.json: the page's 15 lines (8 on pages 1–2):
//   { p, lines: [ {t:"s", s} | {t:"b", s} | {t:"a", c?, w:[[ "s:a:w" | "s:a:e", glyph, 2? ], …]} ] }
// t: "s" the surah-name line, "b" the basmala line, "a" a line of words;
// c: 1 when the line is printed centred. A word key "s:a:w" is the same word
// position as words.ts (splitAyah); "s:a:e" is the ayah-end glyph, never a
// word. A third element 2: the glyph stands for two of our words (w and w+1,
// see MERGED).

import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [layoutPath, glyphsPath] = process.argv.slice(2);
if (!layoutPath || !glyphsPath) {
  console.error("usage: node --no-warnings scripts/import-qcf-v2.mjs <layout.db> <glyphs.db>");
  process.exit(1);
}
const root = resolve(import.meta.dirname, "..");
const outDir = join(root, "public", "mushaf", "v2");
mkdirSync(outDir, { recursive: true });

const PAGES = 604;

// Where one QCF glyph is two words in our text (Tanzil, words.ts): the ayah →
// those glyphs' word numbers in the QUL data. The import fails unless every
// other ayah has exactly as many glyph words as we have words.
const MERGED = {
  "37:130": [3], // «إِلْ يَاسِينَ»: one glyph, two words in Tanzil
};

// our word count per ayah, as words.ts counts it (tokens with a letter, without the basmala Tanzil prefixes)
const LETTER = /[ء-يٮ-ٯٱ-ۓەۮ-ۯۺ-ۼۿ]/;
const tanzil = JSON.parse(readFileSync(join(root, "src", "lib", "quran-data", "quran-uthmani.json"), "utf8")).surahs;
const ourCount = (s, a) => {
  let tokens = tanzil[s - 1][a - 1].split(" ").filter(Boolean);
  if (a === 1 && s !== 1 && s !== 9) tokens = tokens.slice(4);
  return tokens.filter((t) => LETTER.test(t)).length;
};

const layout = new DatabaseSync(layoutPath, { readOnly: true });
const glyphs = new DatabaseSync(glyphsPath, { readOnly: true });
const info = layout.prepare("select * from info").get();
if (info?.number_of_pages !== PAGES || info.lines_per_page !== 15) throw new Error(`unexpected layout: ${JSON.stringify(info)}`);

// every glyph entry, by id, keyed by our word positions
const rows = glyphs.prepare("select id, surah, ayah, word, text from words order by id").all();
const entryById = new Map();
let ayat = 0;
for (let i = 0; i < rows.length; ) {
  const { surah: s, ayah: a } = rows[i];
  let j = i;
  while (j < rows.length && rows[j].surah === s && rows[j].ayah === a) j++;
  const ayahRows = rows.slice(i, j); // its words, then its end glyph
  ayat++;
  const merged = MERGED[`${s}:${a}`] ?? [];
  const glyphWords = ayahRows.length - 1;
  if (glyphWords + merged.length !== ourCount(s, a)) throw new Error(`${s}:${a}: ${glyphWords} glyph words (+${merged.length} merged), we have ${ourCount(s, a)}`);
  let ours = 0;
  ayahRows.forEach((r, k) => {
    if (r.word !== k + 1 || r.id !== ayahRows[0].id + k) throw new Error(`${s}:${a}: entries out of order at ${r.location}`);
    if (!r.text) throw new Error(`${r.location}: no glyph`);
    if (k === ayahRows.length - 1) {
      entryById.set(r.id, [`${s}:${a}:e`, r.text]);
      return;
    }
    const span = merged.includes(r.word) ? 2 : 1;
    entryById.set(r.id, span === 2 ? [`${s}:${a}:${ours + 1}`, r.text, 2] : [`${s}:${a}:${ours + 1}`, r.text]);
    ours += span;
  });
  i = j;
}
if (ayat !== 6236) throw new Error(`${ayat} ayat in the glyph data`);

let nextId = rows[0].id;
const lines = layout.prepare("select * from pages order by page_number, line_number").all();
let lastSurahName = null;
for (let p = 1; p <= PAGES; p++) {
  const own = lines.filter((l) => l.page_number === p);
  const total = p <= 2 ? 8 : 15;
  if (own.length !== total || own.some((l, i) => l.line_number !== i + 1)) throw new Error(`page ${p}: lines ${own.map((l) => l.line_number)}`);
  const out = own.map((l) => {
    if (l.line_type === "surah_name") {
      lastSurahName = Number(l.surah_number);
      return { t: "s", s: lastSurahName };
    }
    // the basmala of the surah whose name came last (on this page or the one before)
    if (l.line_type === "basmallah") return { t: "b", s: lastSurahName };
    if (l.line_type !== "ayah") throw new Error(`page ${p} line ${l.line_number}: ${l.line_type}`);
    const from = Number(l.first_word_id);
    const to = Number(l.last_word_id);
    // every glyph exactly once, in order
    if (from !== nextId || to < from) throw new Error(`page ${p} line ${l.line_number}: words ${from}–${to}, expected from ${nextId}`);
    nextId = to + 1;
    const w = [];
    for (let id = from; id <= to; id++) {
      if (!entryById.has(id)) throw new Error(`page ${p}: no glyph ${id}`);
      w.push(entryById.get(id));
    }
    return l.is_centered ? { t: "a", c: 1, w } : { t: "a", w };
  });
  writeFileSync(join(outDir, `p${p}.json`), JSON.stringify({ p, lines: out }));
}
if (nextId !== rows.at(-1).id + 1) throw new Error(`the pages stop at glyph ${nextId - 1} of ${rows.at(-1).id}`);
console.log(`wrote ${PAGES} pages to ${outDir} (${rows.length} glyph entries, ${ayat} ayat)`);
