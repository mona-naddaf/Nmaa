import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDashboard, dashboardSections, type DashFacts, type DashRows, type DashViewer } from "./dashboard-build";

// A whole family, with every kind of data, to check what each viewer gets —
// and, by the JSON that would leave the server, what she never gets.
const T = (iso: string) => new Date(iso);
const facts = (siblingsVisible: boolean, share: Partial<Record<"mona" | "ahmad" | "huda", { p?: boolean; t?: boolean }>> = {}): DashFacts => ({
  familyId: "fam1",
  siblingsVisible,
  children: [
    { id: "kid-laila", name: "ليلى", gender: "FEMALE", createdAt: T("2026-10-01T00:00:00Z"), planChangedAt: null },
    { id: "kid-omar", name: "عمر", gender: "MALE", createdAt: T("2026-10-01T00:00:00Z"), planChangedAt: null },
  ],
  adults: (["mona", "ahmad", "huda"] as const).map((k) => ({
    id: `adult-${k}`,
    name: { mona: "منى", ahmad: "أحمد", huda: "هدى" }[k],
    gender: k === "ahmad" ? ("MALE" as const) : ("FEMALE" as const),
    createdAt: T("2026-09-01T00:00:00Z"),
    planChangedAt: null,
    shareProgress: !!share[k]?.p,
    shareTracker: !!share[k]?.t,
  })),
});

const everyone = ["kid-laila", "kid-omar", "adult-mona", "adult-ahmad", "adult-huda"];
const rows: DashRows = {
  planItems: everyone.flatMap((u) => [114, 113, 112].map((surahNumber, position) => ({ userId: u, surahNumber, position }))),
  sessions: everyone.map((u) => ({ userId: u, source: "LOGGED" as const, type: "NEW" as const, surahNumber: 114, fromAyah: 1, toAyah: 3, situation: "CONTINUE" as const, reason: null, createdAt: T("2026-10-16T08:00:00Z"), day: T("2026-10-16T00:00:00Z") })),
  goals: everyone.map((u) => ({ userId: u, target: "PLAN" as const, juz: null, surah: null, ayah: null, startDay: T("2026-10-01T00:00:00Z"), deadline: T("2027-01-01T00:00:00Z") })),
  commitDays: everyone.map((u) => ({ userId: u, days: 127, effectiveFrom: T("2026-10-01T00:00:00Z") })),
  trackerItems: everyone.map((u, n) => ({ id: `item-${u}`, userId: u, value: 3 + n, days: 127, createdAt: T("2026-10-01T00:00:00Z"), archivedAt: null })),
  checks: everyone.map((u) => ({ userId: u, itemId: `item-${u}`, day: T("2026-10-16T00:00:00Z") })),
};

const adultViewer: DashViewer = { kind: "ADULT", id: "adult-huda" };
const laila: DashViewer = { kind: "CHILD", id: "kid-laila" };
const json = (v: unknown) => JSON.stringify(v);

test("sections: an adult sees every child; a child her siblings only with the switch on", () => {
  assert.deepEqual(dashboardSections(adultViewer, facts(false)).childIds, ["kid-laila", "kid-omar"]);
  assert.deepEqual(dashboardSections(laila, facts(false)).childIds, []);
  assert.deepEqual(dashboardSections(laila, facts(true)).childIds, ["kid-omar"]);
  // queries are limited to what's allowed
  const s = dashboardSections(laila, facts(false, { mona: { p: true }, ahmad: { t: true } }));
  assert.deepEqual(s.sessionSubjects, ["adult-mona"]);
  assert.deepEqual(s.trackerSubjects, ["adult-ahmad"]);
});

test("shape: a child with siblings off gets nothing of her siblings", () => {
  const out = json(buildDashboard(laila, facts(false), rows));
  for (const leak of ["kid-omar", "عمر", "item-kid-omar"]) assert.ok(!out.includes(leak), leak);
  assert.deepEqual(buildDashboard(laila, facts(false), rows).children, []);
});

test("shape: with siblings on, three facts only — and never her own card", () => {
  const d = buildDashboard(laila, facts(true), rows);
  assert.equal(d.children.length, 1);
  const omar = d.children[0];
  assert.equal(omar.name, "عمر");
  assert.ok(omar.progress && omar.tracker);
  // no goal, streak or pages for a sibling; no link; no real id
  assert.equal(omar.progress.goal, undefined);
  assert.equal(omar.progress.streak, undefined);
  assert.equal(omar.progress.memorizedPages, undefined);
  assert.equal(omar.href, undefined);
  assert.ok(!json(d).includes("kid-omar") && !json(d).includes("kid-laila"));
});

test("shape: adults who share nothing don't appear; each shares only what she chose", () => {
  const d = buildDashboard(adultViewer, facts(false, { mona: { p: true }, ahmad: { t: true } }), rows);
  const out = json(d);
  assert.deepEqual(d.adults.map((a) => a.name), ["منى", "أحمد"]);
  const [mona, ahmad] = d.adults;
  assert.ok(mona.progress && !mona.tracker, "mona: progress only");
  assert.ok(ahmad.tracker && !ahmad.progress, "ahmad: tracker only");
  assert.ok(mona.progress.goal && mona.progress.streak && mona.progress.memorizedPages !== undefined);
  // هدى shares nothing: not her name, not her rows (she is the viewer here, and still absent)
  assert.ok(!out.includes("هدى") && !out.includes("item-adult-huda"));
  // the real ids of anyone never leave in the adults' section
  for (const id of ["adult-mona", "adult-ahmad", "adult-huda"]) assert.ok(!out.includes(id), id);
});

test("shape: tracker completion only — no titles, no real item ids", () => {
  const d = buildDashboard(adultViewer, facts(false, { ahmad: { t: true } }), rows);
  const out = json(d);
  assert.ok(!/"title"/.test(out), "no title field anywhere");
  for (const u of everyone) assert.ok(!out.includes(`item-${u}`), `item-${u}`);
  const t = d.adults[0].tracker!;
  assert.deepEqual(t.items.map((i) => i.id), ["t0"]);
  assert.deepEqual(t.checks, { "2026-10-16": ["t0"] });
  assert.deepEqual(Object.keys(t.items[0]).sort(), ["archivedAt", "archivedDay", "createdAt", "createdDay", "days", "id", "status", "value"]);
});

test("progress: position from her sessions and plan; the days she recorded", () => {
  const d = buildDashboard(adultViewer, facts(false), rows);
  const l = d.children.find((c) => c.name === "ليلى")!;
  assert.deepEqual(l.progress?.position, { surahNumber: 114, ayah: 3 });
  assert.deepEqual(l.progress?.loggedDays, ["2026-10-16"]);
  assert.equal(l.href, "/rafiq/family/fam1/child/kid-laila");
});

test("shape: a sibling's tracker is today's completion only — no earlier days", () => {
  const old = { ...rows, checks: [...rows.checks, { userId: "kid-omar", itemId: "item-kid-omar", day: T("2026-10-10T00:00:00Z") }] };
  const now = T("2026-10-16T12:00:00Z");
  const sibling = buildDashboard(laila, facts(true), old, now).children[0].tracker!;
  assert.equal(sibling.todayOnly, true);
  assert.deepEqual(Object.keys(sibling.checks), ["2026-10-16"]);
  // an adult still gets the last days
  const adult = buildDashboard(adultViewer, facts(true), old, now).children.find((c) => c.name === "عمر")!.tracker!;
  assert.equal(adult.todayOnly, undefined);
  assert.deepEqual(Object.keys(adult.checks).sort(), ["2026-10-10", "2026-10-16"]);
});
