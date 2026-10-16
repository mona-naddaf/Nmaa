// «العائلة»: limits and pure rules (no DB), shared by the actions, the pages
// and the tests (rules.test.ts).

export const FAMILY_LIMITS = {
  // families one adult belongs to (founded ones included)
  familiesPerAdult: 10,
  adultsPerFamily: 20,
  childrenPerFamily: 15,
  // invite رموز that are valid at the same time, per family
  validInvites: 5,
  // families one adult may create in 24 hours
  createdPerDay: 3,
  nameMax: 40,
} as const;

// an invite رمز is valid for 7 days from its creation (or until revoked)
export const INVITE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function inviteExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + INVITE_DAYS * DAY_MS);
}

export type InviteState = "valid" | "expired" | "revoked";

export function inviteState(invite: { expiresAt: Date; revokedAt: Date | null }, now: Date = new Date()): InviteState {
  if (invite.revokedAt) return "revoked";
  return invite.expiresAt.getTime() > now.getTime() ? "valid" : "expired";
}

/** Expired or revoked رموز stay in the founder's list, marked, for 7 more days. */
export function inviteListed(invite: { expiresAt: Date; revokedAt: Date | null }, now: Date = new Date()): boolean {
  const ended = invite.revokedAt ?? invite.expiresAt;
  return ended.getTime() + INVITE_DAYS * DAY_MS > now.getTime();
}

export function cleanFamilyName(raw: unknown): { name: string } | { error: string } {
  const name = (typeof raw === "string" ? raw : "").replace(/\s+/g, " ").trim();
  if (!name) return { error: "يُرجى إدخال اسم العائلة" };
  if (name.length > FAMILY_LIMITS.nameMax) return { error: `يُرجى ألّا يزيد اسم العائلة على ${FAMILY_LIMITS.nameMax} حرفًا` };
  return { name };
}

// After signing in or up, only the family join page is a valid place to go
// back to (an open redirect otherwise): "/rafiq/family/join", optionally with
// ?code= in the رمز's alphabet. Anything else is null.
const JOIN_PATH = "/rafiq/family/join";

export function safeNext(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw === JOIN_PATH) return raw;
  const m = raw.match(/^\/rafiq\/family\/join\?code=([A-Za-z0-9-]{1,12})$/);
  return m ? `${JOIN_PATH}?code=${m[1].toUpperCase()}` : null;
}
