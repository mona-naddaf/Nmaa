import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { excuseAllowed, excuseEnabled, parseAllowList } from "./enabled";

// EXCUSE_ENABLED and, while it is tried out on the live site, EXCUSE_ALLOW_EMAILS.

const saved = { on: process.env.EXCUSE_ENABLED, list: process.env.EXCUSE_ALLOW_EMAILS };
const set = (on: string | undefined, list: string | undefined) => {
  if (on === undefined) delete process.env.EXCUSE_ENABLED;
  else process.env.EXCUSE_ENABLED = on;
  if (list === undefined) delete process.env.EXCUSE_ALLOW_EMAILS;
  else process.env.EXCUSE_ALLOW_EMAILS = list;
};
afterEach(() => set(saved.on, saved.list));

test("allow list: commas, spaces and new lines; trimmed and lowercased; unset = no list", () => {
  assert.equal(parseAllowList(undefined), null);
  assert.deepEqual([...parseAllowList(" Mona@Example.com, a@b.co\nc@d.org ;")!], ["mona@example.com", "a@b.co", "c@d.org"]);
  assert.equal(parseAllowList("")!.size, 0);
});

test("off: nobody, listed or not", () => {
  set(undefined, "mona@example.com");
  assert.equal(excuseEnabled(), false);
  assert.equal(excuseAllowed("mona@example.com"), false);
  set("0", undefined);
  assert.equal(excuseAllowed("mona@example.com"), false);
});

test("on with a list: only the listed accounts (any case), never a child, an empty list = nobody", () => {
  set("1", "mona@example.com");
  assert.equal(excuseAllowed("mona@example.com"), true);
  assert.equal(excuseAllowed(" MONA@example.com "), true);
  assert.equal(excuseAllowed("other@example.com"), false);
  assert.equal(excuseAllowed(null), false);
  assert.equal(excuseAllowed(undefined), false);
  set("1", "");
  assert.equal(excuseAllowed("mona@example.com"), false);
});

test("on without a list: nobody — «*» opens it to everyone (children included)", () => {
  set("1", undefined);
  assert.equal(excuseAllowed("anyone@example.com"), false);
  set("1", "*");
  assert.equal(excuseAllowed("anyone@example.com"), true);
  assert.equal(excuseAllowed(null), true);
});
