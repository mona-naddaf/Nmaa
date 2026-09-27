// Converts the Tanzil Uthmani text into src/lib/quran-data/quran-uthmani.json.
//
// Usage:
//   1. Download "Uthmani" text, output "Text (with aya numbers)" from
//      https://tanzil.net/download/ (pause marks and sajdah signs included).
//   2. node scripts/import-tanzil-text.mjs path/to/quran-uthmani.txt
//
// The text is copied VERBATIM, one string per ayah — Tanzil's license does
// not allow changing it. Splitting into words (and setting aside the basmala
// Tanzil prefixes to each surah's first ayah) happens at display time, in
// src/lib/quran-data/words.ts. The copyright notice travels with the JSON,
// as the license requires for derived files.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/import-tanzil-text.mjs <quran-uthmani.txt>");
  process.exit(1);
}

const raw = fs.readFileSync(input, "utf8").replace(/\r\n/g, "\n");
const surahsMeta = JSON.parse(fs.readFileSync(path.join(root, "src/lib/quran-data/surahs.json"), "utf8"));

const notice = raw
  .split("\n")
  .filter((l) => l.startsWith("#"))
  .join("\n");
if (!notice.includes("Tanzil")) throw new Error("copyright block not found — is this the Tanzil file?");

const surahs = surahsMeta.map(() => []);
for (const line of raw.split("\n")) {
  const m = line.match(/^(\d+)\|(\d+)\|(.+)$/);
  if (!m) continue;
  const [, s, a, text] = m;
  const list = surahs[Number(s) - 1];
  if (!list) throw new Error(`unknown surah ${s}`);
  if (Number(a) !== list.length + 1) throw new Error(`${s}:${a} out of order`);
  list.push(text);
}

// every surah and ayah count must match the app's own metadata
let total = 0;
surahsMeta.forEach((meta, i) => {
  if (surahs[i].length !== meta.ayahs) {
    throw new Error(`surah ${meta.number}: ${surahs[i].length} ayat, expected ${meta.ayahs}`);
  }
  total += surahs[i].length;
});
if (total !== 6236) throw new Error(`${total} ayat, expected 6236`);

// the basmala prefix words.ts sets aside: the first 4 words of every first
// ayah except al-Fatiha's (where it IS the ayah) and at-Tawba's (none).
// Compared against Tanzil's own basmala (1:1), never hand-typed text: the
// diacritic order matters for equality. At-Tin and al-Qadr write the first
// word with a shadda (بِّسْمِ), so that one mark is allowed to differ.
const basmala = surahs[0][0].split(" ");
const withoutShadda = (w) => w.replace(/ّ/g, "");
surahs.forEach((ayahs, i) => {
  const n = i + 1;
  if (n === 1 || n === 9) return;
  const words = ayahs[0].split(" ");
  const ok =
    words.length > 4 &&
    withoutShadda(words[0]) === withoutShadda(basmala[0]) &&
    basmala.slice(1).every((w, k) => words[k + 1] === w);
  if (!ok) throw new Error(`surah ${n}: first ayah doesn't start with the basmala`);
});

const out = {
  notice,
  source: "Tanzil Quran Text (Uthmani, Version 1.1) — https://tanzil.net",
  surahs,
};
const target = path.join(root, "src/lib/quran-data/quran-uthmani.json");
fs.writeFileSync(target, JSON.stringify(out) + "\n");
console.log(`wrote ${path.relative(root, target)}: 114 surahs, ${total} ayat`);
