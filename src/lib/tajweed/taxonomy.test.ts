import { test } from "node:test";
import assert from "node:assert/strict";
import { ALPHABET, confusionsFor, isConfusionLetter, makharijFor, MAKHARIJ, sifatFor, SIFAT } from "./letter-facts";
import { splitLetters } from "./letters";
import { detailLabel, GAP_GROUPS, GENERAL, hukmByCode, isCodeFor, LETTER_GROUPS } from "./taxonomy";

// the codes stored with an error (group codes only order the picker)
const storedCodes = [
  ...MAKHARIJ.map((m) => m.code),
  ...SIFAT.map((s) => s.code),
  ...[...LETTER_GROUPS, ...GAP_GROUPS].flatMap((g) => g.rules.map((r) => r.code)),
];
const groupCodes = [...LETTER_GROUPS, ...GAP_GROUPS].map((g) => g.code);

test("codes are stable ASCII and never repeat", () => {
  for (const c of [...storedCodes, ...groupCodes]) assert.match(c, /^[a-z_]+(\.[a-z_]+)*$/, c);
  assert.equal(new Set(storedCodes).size, storedCodes.length);
  assert.equal(new Set(groupCodes).size, groupCodes.length);
  assert.equal(MAKHARIJ.length, 17);
  assert.equal(SIFAT.length, 16);
});

test("labels: Arabic, never empty, never «كود»", () => {
  const labels = [
    ...MAKHARIJ.map((m) => m.label),
    ...SIFAT.map((s) => s.label),
    ...[...LETTER_GROUPS, ...GAP_GROUPS].flatMap((g) => [g.label, ...g.rules.map((r) => r.label)]),
  ];
  for (const l of labels) {
    assert.ok(l.trim().length > 0);
    assert.match(l, /[؀-ۿ]/);
    assert.doesNotMatch(l, /كود/);
  }
});

test("isCodeFor: a code only on its own kind and target", () => {
  assert.ok(isCodeFor("HUKM", "LETTER", "madd.muttasil"));
  assert.ok(!isCodeFor("HUKM", "GAP", "madd.muttasil"));
  assert.ok(isCodeFor("HUKM", "GAP", "gap_madd.munfasil"));
  assert.ok(!isCodeFor("HUKM", "LETTER", "gap_madd.munfasil"));
  assert.ok(isCodeFor("SIFA", "LETTER", "istitala"));
  assert.ok(!isCodeFor("HUKM", "LETTER", "istitala"));
  assert.ok(isCodeFor("MAKHRAJ", "LETTER", "hafat_lisan"));
  assert.ok(!isCodeFor("MAKHRAJ", "GAP", GENERAL)); // a gap holds rules only
  assert.ok(!isCodeFor("SIFA", "GAP", GENERAL));
  assert.ok(isCodeFor("HUKM", "GAP", GENERAL));
  assert.ok(!isCodeFor("HUKM", "LETTER", "madd")); // a group, not a rule
  assert.ok(!isCodeFor("HUKM", "LETTER", "nope"));
});

test("detailLabel: the kind, and the detail when there is one", () => {
  assert.deepEqual(detailLabel("HUKM", "madd.muttasil"), { kind: "حكم تجويد", detail: "المدود: المتصل" });
  assert.deepEqual(detailLabel("SIFA", "istitala"), { kind: "صفة", detail: "الاستطالة" });
  assert.deepEqual(detailLabel("MAKHRAJ", "hafat_lisan"), { kind: "مخرج", detail: "حافة اللسان" });
  assert.deepEqual(detailLabel("MAKHRAJ", GENERAL), { kind: "مخرج", detail: null });
  assert.equal(hukmByCode("gap_sakt.tark")?.group.label, "سكتات حفص");
});

test("every letter has a makhraj and sifat; every makhraj is someone's", () => {
  const used = new Set<string>();
  for (const l of [...ALPHABET, "ا", "ة", "ى"]) {
    const unit = splitLetters(l)[0];
    const m = makharijFor(unit, undefined);
    assert.ok(m.length > 0, l);
    m.forEach((c) => used.add(c));
  }
  for (const m of MAKHARIJ) assert.ok(used.has(m.code), m.code);
  for (const l of ALPHABET) assert.ok(sifatFor(splitLetters(l + "َ")[0], undefined).length >= 4, l);
});

test("makharij: the likely one first, and the others it may come from", () => {
  const u = (w: string, i: number) => [splitLetters(w)[i - 1], splitLetters(w)[i - 2]] as const;
  assert.deepEqual(makharijFor(...u("ضَ", 1)), ["hafat_lisan"]);
  assert.deepEqual(makharijFor(...u("نْ", 1)), ["taraf_lisan_n", "khayshum"]);
  assert.deepEqual(makharijFor(...u("مٌ", 1)), ["shafatan", "khayshum"]);
  // a madd waw: الجوف first; a voweled one: the lips first
  assert.deepEqual(makharijFor(...u("قَالُوا", 4)), ["jawf", "shafatan"]);
  assert.deepEqual(makharijFor(...u("وَ", 1)), ["shafatan", "jawf"]);
  assert.deepEqual(makharijFor(...u("رَحْمَةٌ", 4)), ["nitiyya", "aqsa_halq", "khayshum"]);
});

test("sifat of a few letters", () => {
  const s = (w: string, i = 1) => sifatFor(splitLetters(w)[i - 1], splitLetters(w)[i - 2]);
  assert.deepEqual(s("ضَ"), ["jahr", "rakhawa", "istila", "itbaq", "istitala"]);
  assert.deepEqual(s("قَ"), ["jahr", "shidda", "istila", "infitah", "qalqala"]);
  assert.deepEqual(s("رَ"), ["jahr", "tawassut", "istifal", "infitah", "inhiraf", "takrir"]);
  assert.deepEqual(s("سَ"), ["hams", "rakhawa", "istifal", "infitah", "safir"]);
  assert.deepEqual(s("خَوْف", 2), ["jahr", "rakhawa", "istifal", "infitah", "leen"]);
  assert.deepEqual(s("قَالَ", 2), []); // the madd alif
});

test("«نُطق قريبًا من حرف»: the common confusions first, never the letter itself", () => {
  const d = confusionsFor("ض");
  assert.deepEqual(d.suggested, ["ظ", "د"]);
  assert.equal(d.suggested.length + d.rest.length, 27);
  assert.ok(!d.rest.includes("ض"));
  assert.deepEqual(confusionsFor("ث").suggested, ["س", "ت"]);
  assert.equal(confusionsFor("م").suggested.length, 0);
  assert.ok(isConfusionLetter("ظ"));
  assert.ok(!isConfusionLetter("ظظ"));
  assert.ok(!isConfusionLetter("x"));
  assert.ok(!isConfusionLetter(null));
});
