import "server-only";
import { prisma } from "@/lib/db";
import { getRafiqUser, type RafiqUserSession } from "@/lib/rafiq/session";
import { familyEnabled } from "./enabled";
import { inviteListed, inviteState, type InviteState } from "./rules";

// «العائلة»: who may see and do what in one family. Every family page and
// action gets the signed-in adult and her place in the family from here, from
// the database on each request (never from the page), so a member who was
// removed or a founder who handed the role over loses it immediately.

export const SIGNED_OUT = "انتهت الجلسة، يُرجى تسجيل الدخول مرة أخرى";
export const FAMILY_OFF = "العائلة غير متاحة حاليًا";
export const NOT_AVAILABLE = "هذه العائلة غير متاحة";
export const FOUNDER_ONLY = "هذا الإجراء متاح لمؤسِّس العائلة فقط";
export const EDITORS_ONLY = "هذا الإجراء متاح لمن يستطيع تعديل بيانات الأطفال";

export type FamilyAccess = {
  user: RafiqUserSession;
  family: { id: string; name: string; founderId: string };
  isFounder: boolean;
  // edit the children's data: the founder always, others when given the right
  canEditChildren: boolean;
};

/** The signed-in adult, while «العائلة» is on. */
export async function familyUser(): Promise<RafiqUserSession | { error: string }> {
  if (!familyEnabled()) return { error: FAMILY_OFF };
  return (await getRafiqUser()) ?? { error: SIGNED_OUT };
}

/** Her access to one family she belongs to, or an error (also for a family that isn't hers). */
export async function familyAccess(familyId: unknown): Promise<FamilyAccess | { error: string }> {
  const user = await familyUser();
  if ("error" in user) return user;
  if (typeof familyId !== "string" || !familyId) return { error: NOT_AVAILABLE };
  const member = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId: user.id } },
    select: { canEditChildren: true, family: { select: { id: true, name: true, founderId: true } } },
  });
  if (!member) return { error: NOT_AVAILABLE };
  const isFounder = member.family.founderId === user.id;
  return { user, family: member.family, isFounder, canEditChildren: isFounder || member.canEditChildren };
}

/** The founder's access to her family, or an error for everyone else. */
export async function founderAccess(familyId: unknown): Promise<FamilyAccess | { error: string }> {
  const access = await familyAccess(familyId);
  if ("error" in access) return access;
  return access.isFounder ? access : { error: FOUNDER_ONLY };
}

/** An adult who may change the children (the founder, or given edit rights), or an error. */
export async function editorAccess(familyId: unknown): Promise<FamilyAccess | { error: string }> {
  const access = await familyAccess(familyId);
  if ("error" in access) return access;
  return access.canEditChildren ? access : { error: EDITORS_ONLY };
}

export type FamilyCard = { id: string; name: string; isFounder: boolean; adults: number; children: number };

/** «عائلاتي»: every family she belongs to, oldest membership first. */
export async function myFamilies(userId: string): Promise<FamilyCard[]> {
  const rows = await prisma.familyMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: { family: { select: { id: true, name: true, founderId: true, _count: { select: { members: true, children: true } } } } },
  });
  return rows.map(({ family: f }) => ({ id: f.id, name: f.name, isFounder: f.founderId === userId, adults: f._count.members, children: f._count.children }));
}

export type MemberView = {
  userId: string;
  name: string;
  gender: "MALE" | "FEMALE";
  isFounder: boolean;
  canEditChildren: boolean;
  isMe: boolean;
  // the founder alone sees emails; null for everyone else
  email: string | null;
};

export type ChildView = {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE";
  // her login رمز: only for adults who may change the children (null: none, or not shown)
  code: string | null;
  codeCreatedAt: string | null;
};

export type InviteView = { id: string; code: string; createdAt: string; expiresAt: string; state: InviteState };

export type FamilyView = {
  id: string;
  name: string;
  isFounder: boolean;
  canEditChildren: boolean;
  members: MemberView[];
  childrenCount: number;
  children: ChildView[];
  // the founder's list only (empty for everyone else)
  invites: InviteView[];
};

export async function familyView(access: FamilyAccess): Promise<FamilyView> {
  const { family, user, isFounder } = access;
  const now = new Date();
  const [members, children, invites] = await Promise.all([
    prisma.familyMember.findMany({
      where: { familyId: family.id },
      orderBy: { joinedAt: "asc" },
      select: { userId: true, canEditChildren: true, user: { select: { name: true, gender: true, email: true } } },
    }),
    prisma.rafiqUser.findMany({
      where: { familyId: family.id, kind: "CHILD" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, gender: true, childCode: true, childCodeCreatedAt: true },
    }),
    isFounder
      ? prisma.familyInvite.findMany({ where: { familyId: family.id }, orderBy: { createdAt: "desc" }, select: { id: true, code: true, createdAt: true, expiresAt: true, revokedAt: true } })
      : Promise.resolve([]),
  ]);
  const view: MemberView[] = members.map((m) => ({
    userId: m.userId,
    // a name is required to create or join a family; kept as a fallback for safety
    name: m.user.name ?? "—",
    gender: m.user.gender,
    isFounder: m.userId === family.founderId,
    canEditChildren: m.userId === family.founderId || m.canEditChildren,
    isMe: m.userId === user.id,
    email: isFounder ? m.user.email : null,
  }));
  // the founder first, then in joining order
  view.sort((a, b) => Number(b.isFounder) - Number(a.isFounder));
  return {
    id: family.id,
    name: family.name,
    isFounder,
    canEditChildren: access.canEditChildren,
    members: view,
    childrenCount: children.length,
    children: children.map((c) => ({
      id: c.id,
      name: c.name ?? "",
      gender: c.gender,
      code: access.canEditChildren ? c.childCode : null,
      codeCreatedAt: access.canEditChildren && c.childCodeCreatedAt ? c.childCodeCreatedAt.toISOString() : null,
    })),
    invites: invites
      .filter((i) => inviteListed(i, now))
      .map((i) => ({ id: i.id, code: i.code, createdAt: i.createdAt.toISOString(), expiresAt: i.expiresAt.toISOString(), state: inviteState(i, now) })),
  };
}
