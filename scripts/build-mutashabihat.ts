// Builds src/lib/quran-data/mutashabihat.json («المتشابهات») from QUL's
// (Tarteel) Mutashabihat ul Quran download, checked against our Tanzil text.
//
// Usage:
//   1. Download "Mutashabihat ul Quran" (JSON) from
//      https://qul.tarteel.ai/resources/mutashabihat and unzip it into
//      data/raw/mutashabihat/ (phrases.json; data/raw is not committed).
//   2. JITI_ALIAS="{\"@/\":\"$(pwd -W)/src/\"}" node node_modules/jiti/lib/jiti-cli.mjs \
//        scripts/build-mutashabihat.ts
//
// Ranges outside a verse or misaligned with our word split are dropped, then
// phrases are kept when they have ≥3 words, ≤10 occurrences and ≥2 verses
// (src/lib/mutashabihat/build.ts). The counts are printed; nothing is fixed by hand.

import fs from "node:fs";
import path from "node:path";
import { buildIndex, DEFAULT_OPTIONS, normalizeWord, parseKey, type RawPhrase } from "../src/lib/mutashabihat/build";
import { splitAyah } from "../src/lib/quran-data/words";

const root = path.resolve(__dirname, "..");
const rawFile = path.join(root, "data/raw/mutashabihat/phrases.json");
if (!fs.existsSync(rawFile)) {
  console.error(`missing ${rawFile} — see the usage at the top of this script`);
  process.exit(1);
}
const raw: Record<string, RawPhrase> = JSON.parse(fs.readFileSync(rawFile, "utf8"));
const text: string[][] = JSON.parse(fs.readFileSync(path.join(root, "src/lib/quran-data/quran-uthmani.json"), "utf8")).surahs;

const wordsOf = (key: string): string[] | null => {
  const [s, a] = parseKey(key);
  const ayah = text[s - 1]?.[a - 1];
  return ayah === undefined ? null : splitAyah(s, a, ayah).words.map((w) => normalizeWord(w.text));
};

const { index, log } = buildIndex(raw, wordsOf, DEFAULT_OPTIONS);

const out = {
  notice: "Mutashabihat ul Quran by QUL (Quranic Universal Library, Tarteel) — https://qul.tarteel.ai/resources/mutashabihat. Word ranges follow the Tanzil Uthmani word split (src/lib/quran-data/words.ts).",
  options: DEFAULT_OPTIONS,
  ...index,
};
const file = path.join(root, "src/lib/quran-data/mutashabihat.json");
fs.writeFileSync(file, JSON.stringify(out) + "\n");

console.log(log);
console.log(`wrote ${path.relative(root, file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
