import "server-only";
import { prisma } from "@/lib/db";
import { excuseAllowed, excuseEnabled } from "./enabled";
import { familySees, familyViewerChecks, type FamilyViewer } from "./visibility";

// «أيام العذر» in «العائلة»: a girl's 10th switch and her list of the adults
// who see it. Who sees is decided here, on the server, before anything about
// an excuse is loaded (src/lib/excuse/visibility.ts).

/**
 * The feature reaches this family at all: EXCUSE_ENABLED, and its founder's
 * email in EXCUSE_ALLOW_EMAILS (a child has no email of her own; «*» = every
 * family).
 */
export async function familyExcuseAllowed(familyId: string): Promise<boolean> {
  if (!excuseEnabled()) return false;
  const f = await prisma.family.findUnique({ where: { id: familyId }, select: { founder: { select: { email: true } } } });
  return !!f && excuseAllowed(f.founder.email);
}

/** Her list's own choices: adultId → checked (no row: the default by gender). */
export async function viewerOverrides(childId: string): Promise<Map<string, boolean>> {
  const rows = await prisma.familyExcuseViewer.findMany({ where: { childId }, select: { adultId: true, canSee: true } });
  return new Map(rows.map((r) => [r.adultId, r.canSee]));
}

export type ChildExcuseCard = {
  // her switch
  on: boolean;
  // F5: every adult of the family, in the order they joined
  viewers: { id: string; name: string; gender: "MALE" | "FEMALE"; checked: boolean; you: boolean }[];
  // A4's note: an excuse is open now — only ever true for someone who sees it
  active: boolean;
};

/**
 * «أيام العذر» on a girl's settings page, or null where it doesn't apply (a
 * boy, or the feature not reaching this family). active stays false for an
 * adult who may not see her excuse.
 */
export async function childExcuseCard(familyId: string, child: { id: string; gender: "MALE" | "FEMALE" }, viewer: { id: string; gender: "MALE" | "FEMALE" }): Promise<ChildExcuseCard | null> {
  if (child.gender !== "FEMALE" || !(await familyExcuseAllowed(familyId))) return null;
  const [row, members, overrides] = await Promise.all([
    prisma.rafiqUser.findUniqueOrThrow({ where: { id: child.id }, select: { excuseEnabled: true } }),
    prisma.familyMember.findMany({ where: { familyId }, orderBy: { joinedAt: "asc" }, select: { userId: true, user: { select: { name: true, gender: true } } } }),
    viewerOverrides(child.id),
  ]);
  const adults = members.map((m) => ({ id: m.userId, name: m.user.name ?? "—", gender: m.user.gender }));
  const sees = familySees({ kind: "ADULT", ...viewer }, { ...child, excuseEnabled: row.excuseEnabled }, overrides);
  const active = sees && (await prisma.rafiqExcuse.count({ where: { userId: child.id, endDay: null } })) > 0;
  return {
    on: row.excuseEnabled,
    viewers: familyViewerChecks(adults, overrides).map((a) => ({ ...a, you: a.id === viewer.id })),
    active,
  };
}

/** Whether this viewer sees this girl's excuse (and may start and end it). */
export async function familyViewerSees(familyId: string, viewer: FamilyViewer, childId: string): Promise<boolean> {
  if (!(await familyExcuseAllowed(familyId))) return false;
  const child = await prisma.rafiqUser.findFirst({ where: { id: childId, familyId, kind: "CHILD" }, select: { id: true, gender: true, excuseEnabled: true } });
  return !!child && familySees(viewer, child, await viewerOverrides(childId));
}
