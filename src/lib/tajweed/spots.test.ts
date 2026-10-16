import { test } from "node:test";
import assert from "node:assert/strict";
import { GENERAL } from "./taxonomy";
import { addDetail, GAP, isValidSpot, letterSpot, parseSpotKey, removeDetail, spotKey, WHOLE_WORD, wordKeyOf, type DetailError } from "./spots";

const e = (kind: DetailError["kind"], code: string, confusedWith: string | null = null): DetailError => ({ kind, code, confusedWith });

test("spot keys extend the word key and read back", () => {
  assert.equal(spotKey(2, 255, 3, WHOLE_WORD), "2:255:3"); // the word key FlaggableAyah uses
  assert.equal(spotKey(2, 255, 3, letterSpot(4)), "2:255:3:L4");
  assert.equal(spotKey(2, 255, 3, GAP), "2:255:3:G");
  for (const key of ["2:255:3", "2:255:3:L4", "2:255:3:G"]) {
    const p = parseSpotKey(key)!;
    assert.equal(spotKey(p.surah, p.ayah, p.wordPosition, p.spot), key);
    assert.equal(wordKeyOf(key), "2:255:3");
  }
  for (const bad of ["2:255", "2:255:3:L0", "2:255:3:X", "2:255:3:L", "a:b:c"]) assert.equal(parseSpotKey(bad), null, bad);
  assert.ok(!isValidSpot({ letter: 2, gapAfter: true }));
  assert.ok(!isValidSpot({ letter: -1, gapAfter: false }));
});

test("several errors on one spot, one per kind + code", () => {
  let list = addDetail([], e("MAKHRAJ", "hafat_lisan"));
  list = addDetail(list, e("SIFA", "istitala"));
  assert.equal(list.length, 2);
  // the same code again replaces it (its «قريبًا من حرف» may change)
  list = addDetail(list, e("MAKHRAJ", "hafat_lisan", "ظ"));
  assert.deepEqual(list, [e("MAKHRAJ", "hafat_lisan", "ظ"), e("SIFA", "istitala")]);
});

test("a specific code replaces its kind's general entry; general after specific does nothing", () => {
  let list = addDetail([], e("HUKM", GENERAL));
  list = addDetail(list, e("SIFA", GENERAL));
  list = addDetail(list, e("HUKM", "gap_noon.ikhfa"));
  assert.deepEqual(list, [e("SIFA", GENERAL), e("HUKM", "gap_noon.ikhfa")]);
  const same = addDetail(list, e("HUKM", GENERAL));
  assert.equal(same, list);
  // a second specific code of the same kind is added beside the first
  list = addDetail(list, e("HUKM", "gap_waqf.qabih"));
  assert.deepEqual(list.map((x) => x.code), [GENERAL, "gap_noon.ikhfa", "gap_waqf.qabih"]);
  // general twice stays once
  assert.equal(addDetail([e("SIFA", GENERAL)], e("SIFA", GENERAL)).length, 1);
});

test("removing one error leaves the others", () => {
  const list = [e("MAKHRAJ", "hafat_lisan"), e("SIFA", "istitala"), e("SIFA", "jahr")];
  assert.deepEqual(removeDetail(list, { kind: "SIFA", code: "istitala" }), [e("MAKHRAJ", "hafat_lisan"), e("SIFA", "jahr")]);
  assert.deepEqual(removeDetail(list, { kind: "HUKM", code: "madd.tabii" }), list);
});
