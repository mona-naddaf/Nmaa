import "server-only";
import { prisma } from "@/lib/db";
import { getRafiqUser, type RafiqUserSession } from "./session";
import { getFamilyChild } from "@/lib/family/child-session";
import { decideAccess, type SubjectNeed } from "./access-rules";

export type { SubjectNeed } from "./access-rules";

// Whose «رفيق الحفظ» data an action works on, and whether the signed-in
// person may. Every Rafiq action starts here instead of reading the session
// itself, so this file is the one place that decides access; the rules
// themselves are pure and unit-tested (access-rules.ts).
//
// The actor: the adult's session (cookie on /rafiq) or a child's («العائلة»,
// cookie on /family). Server actions are posted to the page they're used on,
// so one request only ever carries one of the two.
//
// - No subjectId (or her own id): the signed-in person herself — for an
//   adult, exactly the Rafiq behaviour from before «العائلة».
// - A child's id: only for an adult of that child's family. Every member may
//   view; recording and managing need the founder, or an adult the founder
//   gave edit rights to. A child never reaches anyone but herself.

export type SubjectFeatures = {
  // «حفظي في البيت» and marking her own mistakes there; always on for an
  // adult's own data, the child's switches («العائلة», set by adults) otherwise
  homeLog: boolean;
  homeMistakes: boolean;
};

export type Subject = {
  // whose rows: every query of the action is scoped by this id
  id: string;
  kind: "ADULT" | "CHILD";
  gender: "MALE" | "FEMALE";
  name: string | null;
  // who is acting
  actorId: string;
  actorKind: "ADULT" | "CHILD";
  // the actor is the subject (false only for an adult acting on a child)
  self: boolean;
  features: SubjectFeatures;
};

export type SubjectError = { error: string };

export const SIGNED_OUT_MESSAGE = "انتهت الجلسة، يُرجى تسجيل الدخول مرة أخرى";
const SIGNED_OUT: SubjectError = { error: SIGNED_OUT_MESSAGE };
const MESSAGES = {
  "not-available": "هذا الحساب غير متاح",
  "no-edit-rights": "ليست لديك صلاحية التعديل على بيانات هذا الطفل",
  "child-cannot": "هذا متاح لأهلك فقط",
} as const;

const ALL_FEATURES: SubjectFeatures = { homeLog: true, homeMistakes: true };
const childFeatures = (c: { homeLogEnabled: boolean; homeMistakesEnabled: boolean }): SubjectFeatures => ({
  homeLog: c.homeLogEnabled,
  homeMistakes: c.homeLogEnabled && c.homeMistakesEnabled,
});

export function resolveSubject(subjectId: null, need: "self"): Promise<(Subject & { account: RafiqUserSession }) | SubjectError>;
export function resolveSubject(subjectId: unknown, need: Exclude<SubjectNeed, "self">): Promise<Subject | SubjectError>;
export async function resolveSubject(subjectId: unknown, need: SubjectNeed): Promise<(Subject & { account?: RafiqUserSession }) | SubjectError> {
  const target = typeof subjectId === "string" && subjectId !== "" ? subjectId : null;

  const adult = await getRafiqUser();
  if (!adult) {
    // a child's own session («العائلة»): only ever herself
    const child = await getFamilyChild();
    if (!child) return SIGNED_OUT;
    const self = target === null || target === child.id;
    const decision = decideAccess("CHILD", self, null, need);
    if (decision !== "ok") return { error: MESSAGES[decision] };
    const flags = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: child.id }, select: { homeLogEnabled: true, homeMistakesEnabled: true } });
    return { id: child.id, kind: "CHILD", gender: child.gender, name: child.name, actorId: child.id, actorKind: "CHILD", self: true, features: childFeatures(flags) };
  }

  if (target === null || target === adult.id) {
    return { id: adult.id, kind: "ADULT", gender: adult.gender, name: adult.name, actorId: adult.id, actorKind: "ADULT", self: true, features: ALL_FEATURES, account: adult };
  }
  if (need === "self") return { error: MESSAGES["not-available"] };

  const row = await prisma.rafiqUser.findUnique({
    where: { id: target },
    select: {
      kind: true,
      gender: true,
      name: true,
      homeLogEnabled: true,
      homeMistakesEnabled: true,
      family: { select: { founderId: true, members: { where: { userId: adult.id }, select: { canEditChildren: true } } } },
    },
  });
  const membership = row?.family?.members[0];
  const decision = decideAccess(
    "ADULT",
    false,
    row && { kind: row.kind, member: !!membership, canEdit: row.family?.founderId === adult.id || membership?.canEditChildren === true },
    need,
  );
  if (decision !== "ok" || !row) return { error: MESSAGES[decision === "ok" ? "not-available" : decision] };
  return { id: target, kind: "CHILD", gender: row.gender, name: row.name, actorId: adult.id, actorKind: "ADULT", self: false, features: childFeatures(row) };
}

/** What a session or tracker item records about who added it (nothing when she added it herself). */
export function addedBy(s: Subject): { byAdult: boolean; adultId: string | null } {
  return s.self || s.actorKind !== "ADULT" ? { byAdult: false, adultId: null } : { byAdult: true, adultId: s.actorId };
}

/** «العائلة»: the child herself is acting (her own page at /family). */
export const childActing = (s: Subject) => s.actorKind === "CHILD";
