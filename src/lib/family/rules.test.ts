import { test } from "node:test";
import assert from "node:assert/strict";
import { CHILD_FEATURES, cleanFamilyName, FAMILY_LIMITS, inviteExpiry, inviteListed, inviteState, isChildFeature, safeNext } from "./rules";

const at = (iso: string) => new Date(iso);

test("invite: valid for 7 days, then expired; revoked wins", () => {
  const created = at("2026-10-16T10:00:00Z");
  const expiresAt = inviteExpiry(created);
  assert.equal(expiresAt.toISOString(), "2026-10-23T10:00:00.000Z");
  assert.equal(inviteState({ expiresAt, revokedAt: null }, at("2026-10-23T09:59:59Z")), "valid");
  assert.equal(inviteState({ expiresAt, revokedAt: null }, at("2026-10-23T10:00:00Z")), "expired");
  assert.equal(inviteState({ expiresAt, revokedAt: at("2026-10-17T00:00:00Z") }, at("2026-10-18T00:00:00Z")), "revoked");
});

test("invite: an ended رمز stays listed for 7 more days", () => {
  const expiresAt = at("2026-10-23T10:00:00Z");
  assert.equal(inviteListed({ expiresAt, revokedAt: null }, at("2026-10-30T09:00:00Z")), true);
  assert.equal(inviteListed({ expiresAt, revokedAt: null }, at("2026-10-30T11:00:00Z")), false);
  // revoked early: counted from the revocation, not the expiry
  assert.equal(inviteListed({ expiresAt, revokedAt: at("2026-10-17T10:00:00Z") }, at("2026-10-24T11:00:00Z")), false);
});

test("family name: trimmed, required, limited", () => {
  assert.deepEqual(cleanFamilyName("  عائلة   أحمد "), { name: "عائلة أحمد" });
  assert.ok("error" in cleanFamilyName("   "));
  assert.ok("error" in cleanFamilyName(42));
  assert.ok("error" in cleanFamilyName("ع".repeat(FAMILY_LIMITS.nameMax + 1)));
  assert.deepEqual(cleanFamilyName("ع".repeat(FAMILY_LIMITS.nameMax)), { name: "ع".repeat(FAMILY_LIMITS.nameMax) });
});

test("safeNext: only the join page, with an optional رمز", () => {
  assert.equal(safeNext("/rafiq/family/join"), "/rafiq/family/join");
  assert.equal(safeNext("/rafiq/family/join?code=abcd-2345"), "/rafiq/family/join?code=ABCD-2345");
  for (const bad of ["/rafiq", "//evil.example", "https://evil.example/rafiq/family/join", "/rafiq/family/join?code=x&next=/", "/rafiq/family/join/../../settings", "/rafiq/family/joinx", null, 7]) {
    assert.equal(safeNext(bad), null, String(bad));
  }
});

test("child switches: the eight known names only, each its own column", () => {
  const keys = Object.keys(CHILD_FEATURES);
  assert.deepEqual(keys.sort(), ["agenda", "goal", "homeLog", "homeMistakes", "mutashabihat", "streak", "summary", "tajweed"]);
  for (const k of keys) assert.equal(isChildFeature(k), true, k);
  // nothing else reaches the database column map — inherited keys included
  for (const bad of ["toString", "constructor", "__proto__", "kind", "planTemplate", "", null, 1]) assert.equal(isChildFeature(bad), false, String(bad));
  assert.equal(new Set(Object.values(CHILD_FEATURES)).size, keys.length);
});
