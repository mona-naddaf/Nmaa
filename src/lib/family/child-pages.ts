import "server-only";
import { prisma } from "@/lib/db";
import type { PersonRef } from "@/lib/rafiq/scope";
import { familyAccess, type FamilyAccess } from "./data";

// What the child's pages need beyond her Rafiq data: the family's adults by
// name (for «مع {الاسم}» / «سجّلها {الاسم}»), and — on an adult's page — that
// the child really is in that adult's family. What may be changed is still
// decided by the actions themselves (src/lib/rafiq/subject.ts).

/** The family's adults, by id. An adult who left is no longer named («أحد البالغين»). */
export async function familyAdults(familyId: string): Promise<Record<string, PersonRef>> {
  const rows = await prisma.familyMember.findMany({ where: { familyId }, select: { userId: true, user: { select: { name: true, gender: true } } } });
  return Object.fromEntries(rows.map((r) => [r.userId, { name: r.user.name ?? "—", gender: r.user.gender }]));
}

export type ChildForAdult = {
  access: FamilyAccess;
  child: { id: string; name: string; gender: "MALE" | "FEMALE"; agendaEnabled: boolean };
  viewer: "adult-edit" | "adult-view";
};

/** An adult of the family on one of its children's pages, or null (not hers, or not a child of this family). */
export async function childForAdult(familyId: string, childId: string): Promise<ChildForAdult | null> {
  const access = await familyAccess(familyId);
  if ("error" in access) return null;
  const child = await prisma.rafiqUser.findFirst({
    where: { id: childId, familyId: access.family.id, kind: "CHILD" },
    select: { id: true, name: true, gender: true, agendaEnabled: true },
  });
  if (!child) return null;
  return { access, child: { ...child, name: child.name ?? "" }, viewer: access.canEditChildren ? "adult-edit" : "adult-view" };
}
