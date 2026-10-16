"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { randomAccessCode, normalizeAccessCode } from "@/lib/auth/access-code";
import { cleanName, DELETE_CONFIRM_WORD } from "@/lib/rafiq/rules";
import { checkPassword } from "@/lib/rafiq/password-check";
import { pickByPerson } from "@/lib/text/gender";
import type { RafiqUserSession } from "@/lib/rafiq/session";
import { familyAccess, familyUser, founderAccess, NOT_AVAILABLE } from "@/lib/family/data";
import { cleanFamilyName, FAMILY_LIMITS, inviteExpiry, inviteState } from "@/lib/family/rules";
import { joinLimited, JOIN_TOO_MANY, recordJoinFailure } from "@/lib/family/limits";

// «العائلة» step 2: creating and joining a family, invite رموز, and the
// founder's management of the adults. Every action re-checks, from the
// database, that the family is on, she's signed in, she belongs to the
// family, and — for everything but leaving — that she founds it
// (src/lib/family/data.ts).

export type FamilyState = { error?: string; ok?: string } | null;

const BAD_CODE = "رمز الدعوة غير صحيح أو انتهت صلاحيته";
const DAY_MS = 24 * 60 * 60 * 1000;

function refresh(familyId?: string) {
  revalidatePath("/rafiq/family", "layout");
  if (familyId) revalidatePath(`/rafiq/family/${familyId}`);
}

/**
 * The name the family will see: her Rafiq name, or — when she has none yet —
 * the one she typed now (saved to her profile with the family). Asked once.
 */
function displayName(user: RafiqUserSession, formData: FormData): { save: string | null } | { error: string } {
  if (user.name) return { save: null };
  const named = cleanName(formData.get("displayName"));
  if ("error" in named) return named;
  if (!named.name) return { error: "يُرجى إدخال اسمك الذي سيظهر لأفراد العائلة" };
  return { save: named.name };
}

const tooManyFamilies = (user: RafiqUserSession) =>
  pickByPerson(user.gender, { m: "بلغتَ", f: "بلغتِ" }) + ` الحدّ الأعلى للعائلات (${FAMILY_LIMITS.familiesPerAdult})`;

export async function createFamilyAction(_prev: FamilyState, formData: FormData): Promise<FamilyState> {
  const user = await familyUser();
  if ("error" in user) return user;
  const named = cleanFamilyName(formData.get("name"));
  if ("error" in named) return named;
  const who = displayName(user, formData);
  if ("error" in who) return who;

  const [memberships, recent] = await Promise.all([
    prisma.familyMember.count({ where: { userId: user.id } }),
    prisma.family.count({ where: { founderId: user.id, createdAt: { gt: new Date(Date.now() - DAY_MS) } } }),
  ]);
  if (memberships >= FAMILY_LIMITS.familiesPerAdult) return { error: tooManyFamilies(user) };
  if (recent >= FAMILY_LIMITS.createdPerDay) return { error: "تم بلوغ الحدّ اليومي لإنشاء العائلات، ويمكن الإنشاء مجددًا غدًا" };

  const family = await prisma.$transaction(async (tx) => {
    if (who.save) await tx.rafiqUser.update({ where: { id: user.id }, data: { name: who.save } });
    return tx.family.create({ data: { name: named.name, founderId: user.id, members: { create: { userId: user.id } } }, select: { id: true } });
  });
  refresh();
  redirect(`/rafiq/family/${family.id}`);
}

export async function joinFamilyAction(_prev: FamilyState, formData: FormData): Promise<FamilyState> {
  const user = await familyUser();
  if ("error" in user) return user;
  const who = displayName(user, formData);
  if ("error" in who) return who;
  const code = normalizeAccessCode(String(formData.get("code") ?? ""));
  if (!code) return { error: "يُرجى إدخال رمز الدعوة" };
  if (await joinLimited(user.id)) return { error: JOIN_TOO_MANY };

  // unknown, expired and revoked رموز get the same answer, and all count
  const invite = await prisma.familyInvite.findUnique({ where: { code }, select: { familyId: true, expiresAt: true, revokedAt: true } });
  if (!invite || inviteState(invite) !== "valid") {
    await recordJoinFailure(user.id);
    return { error: BAD_CODE };
  }

  const outcome = await prisma.$transaction(async (tx) => {
    // one join at a time per family, so the adults limit holds
    await tx.$queryRaw`SELECT id FROM "Family" WHERE id = ${invite.familyId} FOR UPDATE`;
    if (await tx.familyMember.findUnique({ where: { familyId_userId: { familyId: invite.familyId, userId: user.id } }, select: { id: true } })) {
      return { error: pickByPerson(user.gender, { m: "أنت عضو في هذه العائلة مسبقًا", f: "أنتِ عضو في هذه العائلة مسبقًا" }), familyId: invite.familyId };
    }
    const [adults, memberships] = await Promise.all([
      tx.familyMember.count({ where: { familyId: invite.familyId } }),
      tx.familyMember.count({ where: { userId: user.id } }),
    ]);
    if (adults >= FAMILY_LIMITS.adultsPerFamily) return { error: `بلغت العائلة الحدّ الأعلى للبالغين (${FAMILY_LIMITS.adultsPerFamily})` };
    if (memberships >= FAMILY_LIMITS.familiesPerAdult) return { error: tooManyFamilies(user) };
    if (who.save) await tx.rafiqUser.update({ where: { id: user.id }, data: { name: who.save } });
    // view only, nothing shared: the founder gives edit rights, she chooses what to share
    await tx.familyMember.create({ data: { familyId: invite.familyId, userId: user.id } });
    return { familyId: invite.familyId };
  });
  if ("error" in outcome) return { error: outcome.error };
  refresh(outcome.familyId);
  redirect(`/rafiq/family/${outcome.familyId}`);
}

async function uniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomAccessCode();
    if (!(await prisma.familyInvite.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("تعذّر توليد رمز فريد، يُرجى المحاولة مرة أخرى");
}

export async function createInviteAction(familyId: string): Promise<FamilyState> {
  const access = await founderAccess(familyId);
  if ("error" in access) return access;
  const valid = await prisma.familyInvite.count({ where: { familyId: access.family.id, revokedAt: null, expiresAt: { gt: new Date() } } });
  if (valid >= FAMILY_LIMITS.validInvites) {
    return { error: `يمكن أن تكون ${FAMILY_LIMITS.validInvites} رموز دعوة صالحة على الأكثر — يُرجى إلغاء أحدها أولًا` };
  }
  const createdAt = new Date();
  await prisma.familyInvite.create({
    data: { familyId: access.family.id, code: await uniqueInviteCode(), createdById: access.user.id, createdAt, expiresAt: inviteExpiry(createdAt) },
  });
  refresh(access.family.id);
  return {};
}

export async function revokeInviteAction(familyId: string, inviteId: string): Promise<FamilyState> {
  const access = await founderAccess(familyId);
  if ("error" in access) return access;
  const { count } = await prisma.familyInvite.updateMany({
    where: { id: String(inviteId ?? ""), familyId: access.family.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) return { error: "هذا الرمز غير موجود أو أُلغي من قبل" };
  refresh(access.family.id);
  return {};
}

/** Edit rights on the children's data for one adult (the founder always has them). */
export async function setEditRightsAction(familyId: string, memberUserId: string, on: boolean): Promise<FamilyState> {
  const access = await founderAccess(familyId);
  if ("error" in access) return access;
  if (memberUserId === access.family.founderId) return { error: "للمؤسِّس صلاحية التعديل دائمًا" };
  const { count } = await prisma.familyMember.updateMany({
    where: { familyId: access.family.id, userId: String(memberUserId ?? "") },
    data: { canEditChildren: on === true },
  });
  if (count === 0) return { error: "هذا الفرد لم يعد في العائلة" };
  refresh(access.family.id);
  return {};
}

export async function removeMemberAction(familyId: string, memberUserId: string): Promise<FamilyState> {
  const access = await founderAccess(familyId);
  if ("error" in access) return access;
  if (memberUserId === access.user.id) return { error: "لا يمكن للمؤسِّس إزالة نفسه — يمكن نقل دور المؤسِّس أولًا" };
  const { count } = await prisma.familyMember.deleteMany({ where: { familyId: access.family.id, userId: String(memberUserId ?? "") } });
  if (count === 0) return { error: "هذا الفرد لم يعد في العائلة" };
  refresh(access.family.id);
  return {};
}

/**
 * Hands the founder role to another adult of the family. The old founder
 * stays as an adult with edit rights (the new founder may turn them off).
 */
export async function transferFounderAction(familyId: string, memberUserId: string): Promise<FamilyState> {
  const access = await founderAccess(familyId);
  if ("error" in access) return access;
  const target = String(memberUserId ?? "");
  if (target === access.user.id) return { error: "أنت المؤسِّس بالفعل" };
  const done = await prisma.$transaction(async (tx) => {
    const member = await tx.familyMember.findUnique({ where: { familyId_userId: { familyId: access.family.id, userId: target } }, select: { id: true } });
    if (!member) return false;
    // only while she's still the founder (two tabs, two clicks)
    const { count } = await tx.family.updateMany({ where: { id: access.family.id, founderId: access.user.id }, data: { founderId: target } });
    if (count === 0) return false;
    await tx.familyMember.update({ where: { familyId_userId: { familyId: access.family.id, userId: access.user.id } }, data: { canEditChildren: true } });
    return true;
  });
  if (!done) return { error: "تعذّر نقل دور المؤسِّس — يُرجى تحديث الصفحة" };
  refresh(access.family.id);
  return {};
}

export async function renameFamilyAction(familyId: string, name: string): Promise<FamilyState> {
  const access = await founderAccess(familyId);
  if ("error" in access) return access;
  const named = cleanFamilyName(name);
  if ("error" in named) return named;
  await prisma.family.update({ where: { id: access.family.id }, data: { name: named.name } });
  refresh(access.family.id);
  return { ok: "تم حفظ اسم العائلة ✓" };
}

/** Any adult but the founder leaves by herself. */
export async function leaveFamilyAction(familyId: string): Promise<FamilyState> {
  const access = await familyAccess(familyId);
  if ("error" in access) return access;
  if (access.isFounder) return { error: "يُرجى نقل دور المؤسِّس أولًا أو حذف العائلة" };
  await prisma.familyMember.deleteMany({ where: { familyId: access.family.id, userId: access.user.id } });
  refresh();
  redirect("/rafiq/family");
}

/** Deletes the family with all its children and their data (founder only, with her password). */
export async function deleteFamilyAction(_prev: FamilyState, formData: FormData): Promise<FamilyState> {
  const access = await founderAccess(formData.get("familyId"));
  if ("error" in access) return access;
  if (String(formData.get("confirmWord") ?? "").trim() !== DELETE_CONFIRM_WORD) {
    return { error: `يُرجى كتابة كلمة «${DELETE_CONFIRM_WORD}» للتأكيد` };
  }
  const wrong = await checkPassword(access.user, String(formData.get("current") ?? ""));
  if (wrong) return { error: wrong };
  // members, invites, events and children (with every Rafiq row of theirs) cascade
  const { count } = await prisma.family.deleteMany({ where: { id: access.family.id, founderId: access.user.id } });
  if (count === 0) return { error: NOT_AVAILABLE };
  refresh();
  redirect("/rafiq/family");
}
