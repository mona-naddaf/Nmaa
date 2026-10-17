// Who may do what to whose «رفيق الحفظ» data — the pure rules behind
// resolveSubject (subject.ts), with no DB and no cookies, so every case is
// unit-tested (access-rules.test.ts).

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

export type ActorKind = "ADULT" | "CHILD";

/**
 * What resolveSubject loaded about the target, when it isn't the actor:
 * null when there's no such user. member/canEdit describe the actor's place
 * in the target's family (only meaningful for a CHILD target).
 */
export type TargetFacts = {
  kind: "ADULT" | "CHILD";
  // the actor is an adult member of the child's family
  member: boolean;
  // ... and is its founder or was given edit rights
  canEdit: boolean;
} | null;

export type AccessDecision = "ok" | "not-available" | "no-edit-rights" | "child-cannot";

export function decideAccess(actor: ActorKind, self: boolean, target: TargetFacts, need: SubjectNeed): AccessDecision {
  if (self) {
    // a child acts on her own data only, and never on the plan, settings or the account
    if (actor === "CHILD" && (need === "manage" || need === "self")) return "child-cannot";
    return "ok";
  }
  // a child never reaches anyone else (a sibling, another family, an adult)
  if (actor === "CHILD") return "not-available";
  // her own account is never reached through someone else's id
  if (need === "self") return "not-available";
  // adults reach children of their own families only — never another adult
  if (!target || target.kind !== "CHILD" || !target.member) return "not-available";
  if (need === "view") return "ok";
  return target.canEdit ? "ok" : "no-edit-rights";
}
