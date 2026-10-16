import { test } from "node:test";
import assert from "node:assert/strict";
import quranText from "@/lib/quran-data/quran-uthmani.json";
import { splitAyah } from "@/lib/quran-data/words";
import { displayUnits, hasMaddah, isMaddLetter, isSilent, letterAt, splitLetters } from "./letters";

const SURAHS = (quranText as { surahs: string[][] }).surahs;
const wordAt = (s: number, a: number, w: number) => splitAyah(s, a, SURAHS[s - 1][a - 1]).words[w - 1].text;

// a unit compared as its base + its marks in any order (typed literals and
// the Tanzil text don't always order shadda and haraka the same way)
const sig = (unit: string) => [...unit].slice(0, 1).concat([...unit].slice(1).sort()).join("");
const texts = (word: string) => splitLetters(word).map((u) => sig(u.text));
const expected = (...list: string[]) => list.map(sig);
const letters = (word: string) => splitLetters(word).map((u) => u.letter);
// Tanzil writes آ as alif + maddah, never the precomposed letter
const ALIF_MADDA = "آ";

test("the bundled words are the ones these tests expect", () => {
  assert.deepEqual(texts(wordAt(1, 1, 3)), texts("ٱلرَّحْمَـٰنِ"));
  assert.deepEqual(texts(wordAt(1, 1, 2)), texts("ٱللَّهِ"));
  assert.deepEqual(texts(wordAt(6, 143, 10)), texts(`ءَ${ALIF_MADDA}لذَّكَرَيْنِ`));
  assert.deepEqual(texts(wordAt(12, 11, 6)), texts("تَأْمَ۫نَّا"));
});

test("a superscript alif on a tatweel is its own unit, read as alif", () => {
  assert.deepEqual(texts("ٱلرَّحْمَـٰنِ"), expected("ٱ", "ل", "رَّ", "حْ", "مَ", "ـٰ", "نِ"));
  assert.deepEqual(letters("ٱلرَّحْمَـٰنِ"), ["ا", "ل", "ر", "ح", "م", "ا", "ن"]);
});

test("a superscript alif written on a letter stays with it", () => {
  assert.deepEqual(texts("ذَٰلِكَ"), expected("ذَٰ", "لِ", "كَ"));
});

test("لفظ الجلالة: wasl alif, the silent lam, the doubled lam, the haa", () => {
  assert.deepEqual(texts("ٱللَّهِ"), expected("ٱ", "ل", "لَّ", "هِ"));
  assert.deepEqual(texts(wordAt(18, 1, 2)), expected("لِ", "لَّ", "هِ")); // لِلَّهِ
});

test("ءَآ: hamza, then alif with maddah (a madd letter)", () => {
  const units = splitLetters(wordAt(6, 143, 10)); // ءَآلذَّكَرَيْنِ
  assert.deepEqual(units.map((u) => sig(u.text)), expected("ءَ", ALIF_MADDA, "ل", "ذَّ", "كَ", "رَ", "يْ", "نِ"));
  assert.equal(units[1].letter, "ا");
  assert.ok(hasMaddah(units[1]));
  assert.ok(isMaddLetter(units[1], units[0]));
  // the precomposed آ (not in the text, but typed by hand) reads the same
  const typed = splitLetters("ءَآل");
  assert.equal(typed[1].letter, "ا");
  assert.ok(hasMaddah(typed[1]) && isMaddLetter(typed[1], typed[0]));
});

test("a hamza on a tatweel (ـٔ) is its own unit, read as hamza", () => {
  const units = splitLetters(wordAt(2, 4, 10)); // وَبِٱلْـَٔاخِرَةِ
  assert.deepEqual(units.map((u) => sig(u.text)), expected("وَ", "بِ", "ٱ", "لْ", "ـَٔ", "ا", "خِ", "رَ", "ةِ"));
  assert.equal(units[4].letter, "ء");
  // ءَآلْـَٔـٰنَ: two tatweel units in a row
  assert.deepEqual(letters(wordAt(10, 51, 7)), ["ء", "ا", "ل", "ء", "ا", "ن"]);
});

test("small waw and small yaa (الصلة) are units of their own and madd letters", () => {
  const hu = splitLetters(wordAt(2, 17, 9)); // حَوْلَهُۥ
  assert.deepEqual(hu.map((u) => sig(u.text)), expected("حَ", "وْ", "لَ", "هُ", "ۥ"));
  assert.equal(hu[4].letter, "و");
  assert.ok(isMaddLetter(hu[4], hu[3]));
  const hi = splitLetters(wordAt(2, 22, 13)); // بِهِۦ
  assert.deepEqual(hi.map((u) => sig(u.text)), expected("بِ", "هِ", "ۦ"));
  assert.equal(hi[2].letter, "ي");
});

test("small high yaa and noon on a tatweel stand for their letters", () => {
  const nabiyyin = splitLetters(wordAt(2, 61, 52)); // ٱلنَّبِيِّـۧنَ
  assert.deepEqual(nabiyyin.map((u) => sig(u.text)), expected("ٱ", "ل", "نَّ", "بِ", "يِّ", "ـۧ", "نَ"));
  assert.equal(nabiyyin[5].letter, "ي");
  assert.ok(isMaddLetter(nabiyyin[5], nabiyyin[4]));
  const nunji = splitLetters(wordAt(21, 88, 7)); // نُـۨجِى
  assert.deepEqual(nunji.map((u) => u.letter), ["ن", "ن", "ج", "ى"]);
});

test("the Hafs signs stay on their letter: imala, ishmam, tas-hil, small seen", () => {
  assert.deepEqual(texts(wordAt(11, 41, 6)), expected("مَ", "جْ", "ر۪", "ىٰ", "هَ", "ا")); // مَجْر۪ىٰهَا
  assert.deepEqual(texts("تَأْمَ۫نَّا"), expected("تَ", "أْ", "مَ۫", "نَّ", "ا"));
  assert.deepEqual(texts(wordAt(41, 44, 9)), expected("ءَ", "ا۬", "عْ", "جَ", "مِ", "ىٌّ")); // ءَا۬عْجَمِىٌّ
  assert.deepEqual(texts(wordAt(2, 245, 14)), expected("وَ", "يَ", "بْ", "صۜ" + "ُ", "طُ")); // وَيَبْصُۜطُ
  assert.deepEqual(letters(wordAt(52, 37, 7)), ["ا", "ل", "م", "ص", "ي", "ط", "ر", "و", "ن"]); // ٱلْمُصَۣيْطِرُونَ
});

test("iqlab meem, silent letters, and a maddah on a superscript alif", () => {
  assert.deepEqual(texts(wordAt(2, 10, 9)), expected("أَ", "لِ", "ي", "مٌۢ")); // أَلِيمٌۢ
  const ulaika = splitLetters(wordAt(2, 5, 1)); // أُو۟لَـٰٓئِكَ
  assert.deepEqual(ulaika.map((u) => sig(u.text)), expected("أُ", "و۟", "لَ", "ـٰٓ", "ئِ", "كَ"));
  assert.ok(isSilent(ulaika[1]));
  assert.ok(!isMaddLetter(ulaika[1], ulaika[0]));
  assert.ok(hasMaddah(ulaika[3]));
  assert.ok(isSilent(splitLetters(wordAt(2, 258, 21))[2])); // أَنَا۠
});

test("madd letters: a bare waw/yaa after its own haraka only", () => {
  const amin = splitLetters(wordAt(5, 2, 16)); // ءَآمِّينَ
  assert.ok(isMaddLetter(amin[3], amin[2])); // ي after kasra
  const hawl = splitLetters("حَوْلَ");
  assert.ok(!isMaddLetter(hawl[1], hawl[0])); // وْ is leen, not madd
  assert.deepEqual(texts("لَا"), expected("لَ", "ا"));
});

test("letterAt: 1-based, null outside the word", () => {
  assert.equal(letterAt("ٱللَّهِ", 3)?.text, "لَّ");
  assert.equal(letterAt("ٱللَّهِ", 0), null);
  assert.equal(letterAt("ٱللَّهِ", 5), null);
  assert.equal(letterAt("ٱللَّهِ", 1.5), null);
});

test("every word of the Quran: the units give the word back exactly, each with a base letter", () => {
  let words = 0;
  for (let s = 1; s <= SURAHS.length; s++) {
    for (let a = 1; a <= SURAHS[s - 1].length; a++) {
      for (const w of splitAyah(s, a, SURAHS[s - 1][a - 1]).words) {
        words++;
        const units = splitLetters(w.text);
        assert.equal(units.map((u) => u.text).join(""), w.text, `${s}:${a}:${w.position}`);
        for (const u of units) {
          assert.ok(u.base && !/\p{M}/u.test(u.base), `${s}:${a}:${w.position} unit ${u.index}`);
          assert.notEqual(u.letter, "ـ", `${s}:${a}:${w.position}: a tatweel that stands for nothing`);
        }
      }
    }
  }
  assert.ok(words > 77000);
});

test("displayUnits: joiners only between letters that connect, never changing the text", () => {
  const ZWJ = "‍";
  assert.deepEqual(displayUnits(splitLetters("لَا")), ["لَ" + ZWJ, ZWJ + "ا"]);
  // ٱ and ر never connect forward; ل → لَّ → هِ do
  assert.deepEqual(displayUnits(splitLetters("ٱللَّهِ")), ["ٱ", "ل" + ZWJ, ZWJ + "لَّ" + ZWJ, ZWJ + "هِ"]);
  assert.deepEqual(displayUnits(splitLetters("وَرَدَ")), ["وَ", "رَ", "دَ"]);
  for (const w of ["ٱلرَّحْمَـٰنِ", "ءَآلذَّكَرَيْنِ", "بِهِۦ", "أُو۟لَـٰٓئِكَ"]) {
    assert.equal(displayUnits(splitLetters(w)).join("").replaceAll(ZWJ, ""), w);
  }
});
