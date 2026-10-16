import "server-only";
import { prisma } from "@/lib/db";
import { getRafiqUser, type RafiqUserSession } from "./session";

// Whose «رفيق الحفظ» data an action works on, and whether the signed-in
// person may. Every Rafiq action starts here instead of reading the session
// itself, so this file is the one place that decides access.
//
// - No subjectId (or her own id): the signed-in adult herself — exactly the
//   Rafiq behaviour from before «العائلة».
// - A child's id («العائلة», src/lib/family): only for an adult of that
//   child's family. Every member may view; recording and managing need the
//   founder, or an adult the founder gave edit rights to.
//
// The child's own session (name + رمز) arrives in a later step; it will be
// resolved here too, with the child as both actor and subject and the rules
// in `need` below (a child never manages, never reaches "self").

/**
 * - view:   read their data
 * - record: sessions, mistakes, home practice, tracker items and ticks —
 *           the owner herself, or an adult with edit rights
 * - manage: plan, previous memorization, goal and feature settings — the
 *           owner when she's an adult, or an adult with edit rights; never a
 *           child herself
 * - self:   the signed-in adult's own account only (password, profile,
 *           notes, personal calendar, publishing to the template bank)
 */
export type SubjectNeed = "view" | "record" | "manage" | "self";

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
};

export type SubjectError = { error: string };

export const SIGNED_OUT_MESSAGE = "انتهت الجلسة، يُرجى تسجيل الدخول مرة أخرى";
const SIGNED_OUT: SubjectError = { error: SIGNED_OUT_MESSAGE };
const NOT_AVAILABLE: SubjectError = { error: "هذا الحساب غير متاح" };
const NO_EDIT_RIGHTS: SubjectError = { error: "ليست لديك صلاحية التعديل على بيانات هذا الطفل" };

export function resolveSubject(subjectId: null, need: "self"): Promise<(Subject & { account: RafiqUserSession }) | SubjectError>;
export function resolveSubject(subjectId: unknown, need: Exclude<SubjectNeed, "self">): Promise<Subject | SubjectError>;
export async function resolveSubject(subjectId: unknown, need: SubjectNeed): Promise<(Subject & { account?: RafiqUserSession }) | SubjectError> {
  const actor = await getRafiqUser();
  if (!actor) return SIGNED_OUT;

  const target = typeof subjectId === "string" && subjectId !== "" ? subjectId : null;
  if (target === null || target === actor.id) {
    return { id: actor.id, kind: "ADULT", gender: actor.gender, name: actor.name, actorId: actor.id, actorKind: "ADULT", self: true, account: actor };
  }
  // her own account is never reached through someone else's id
  if (need === "self") return NOT_AVAILABLE;

  const child = await prisma.rafiqUser.findFirst({
    where: { id: target, kind: "CHILD", family: { members: { some: { userId: actor.id } } } },
    select: {
      id: true,
      gender: true,
      name: true,
      family: { select: { founderId: true, members: { where: { userId: actor.id }, select: { canEditChildren: true } } } },
    },
  });
  if (!child?.family) return NOT_AVAILABLE;
  if (need !== "view") {
    const canEdit = child.family.founderId === actor.id || child.family.members[0]?.canEditChildren === true;
    if (!canEdit) return NO_EDIT_RIGHTS;
  }
  return { id: child.id, kind: "CHILD", gender: child.gender, name: child.name, actorId: actor.id, actorKind: "ADULT", self: false };
}

/** What a session or tracker item records about who added it (nothing when she added it herself). */
export function addedBy(s: Subject): { byAdult: boolean; adultId: string | null } {
  return s.self || s.actorKind !== "ADULT" ? { byAdult: false, adultId: null } : { byAdult: true, adultId: s.actorId };
}
