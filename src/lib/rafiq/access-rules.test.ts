import { test } from "node:test";
import assert from "node:assert/strict";
import { decideAccess, type AccessDecision, type ActorKind, type SubjectNeed, type TargetFacts } from "./access-rules";

const NEEDS: SubjectNeed[] = ["view", "record", "manage", "self"];

// every actor × target in «العائلة», with what each of the four needs must give
type Row = { who: string; actor: ActorKind; self: boolean; target: TargetFacts; expect: Record<SubjectNeed, AccessDecision> };

const ok = "ok" as const;
const na = "not-available" as const;
const rights = "no-edit-rights" as const;
const childCannot = "child-cannot" as const;
const child = (member: boolean, canEdit: boolean): TargetFacts => ({ kind: "CHILD", member, canEdit });

const MATRIX: Row[] = [
  // her own Rafiq data, exactly as before «العائلة»
  { who: "adult on herself", actor: "ADULT", self: true, target: null, expect: { view: ok, record: ok, manage: ok, self: ok } },
  // a child of her family
  { who: "founder on a child of her family", actor: "ADULT", self: false, target: child(true, true), expect: { view: ok, record: ok, manage: ok, self: na } },
  { who: "adult with edit rights on a child", actor: "ADULT", self: false, target: child(true, true), expect: { view: ok, record: ok, manage: ok, self: na } },
  { who: "view-only adult on a child", actor: "ADULT", self: false, target: child(true, false), expect: { view: ok, record: rights, manage: rights, self: na } },
  // not hers to reach
  { who: "adult outside the child's family", actor: "ADULT", self: false, target: child(false, false), expect: { view: na, record: na, manage: na, self: na } },
  { who: "adult on another adult (same family)", actor: "ADULT", self: false, target: { kind: "ADULT", member: true, canEdit: true }, expect: { view: na, record: na, manage: na, self: na } },
  { who: "adult on an unknown id", actor: "ADULT", self: false, target: null, expect: { view: na, record: na, manage: na, self: na } },
  // the child herself
  { who: "child on herself", actor: "CHILD", self: true, target: null, expect: { view: ok, record: ok, manage: childCannot, self: childCannot } },
  // a child never reaches anyone else, whatever the facts say
  { who: "child on a sibling", actor: "CHILD", self: false, target: child(true, true), expect: { view: na, record: na, manage: na, self: na } },
  { who: "child on a child of another family", actor: "CHILD", self: false, target: child(false, false), expect: { view: na, record: na, manage: na, self: na } },
  { who: "child on an adult of her family", actor: "CHILD", self: false, target: { kind: "ADULT", member: true, canEdit: true }, expect: { view: na, record: na, manage: na, self: na } },
  { who: "child on an unknown id", actor: "CHILD", self: false, target: null, expect: { view: na, record: na, manage: na, self: na } },
];

for (const row of MATRIX) {
  test(`decideAccess: ${row.who}`, () => {
    for (const need of NEEDS) {
      assert.equal(decideAccess(row.actor, row.self, row.target, need), row.expect[need], `${row.who} / ${need}`);
    }
  });
}

test("decideAccess: only ever ok for a view-only adult when reading", () => {
  for (const need of NEEDS) {
    const r = decideAccess("ADULT", false, child(true, false), need);
    assert.equal(r === "ok", need === "view", need);
  }
});
