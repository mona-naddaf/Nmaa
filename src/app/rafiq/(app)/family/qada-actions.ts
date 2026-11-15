"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { resolveSubject } from "@/lib/rafiq/subject";
import { mayChangeViewer } from "@/lib/excuse/visibility";
import { familyQadaAllowed } from "@/lib/qada/server";
import { NOT_AVAILABLE } from "@/lib/family/data";

// «القضاء» on a girl's settings page («العائلة»): her «من يرى…» list, the same
// rows as «أيام العذر»'s, changeable here even while «أيام العذر» is off
// (Mona, 2026-11-15). For the founder and adults with edit rights only, as
// her other switches; nobody checks their own name.

const OFF = { error: NOT_AVAILABLE };

export async function setQadaViewerAction(input: { childId: string; adultId: string; canSee: boolean }): Promise<{ error?: string }> {
  const user = await resolveSubject(input?.childId, "manage");
  if ("error" in user) return user;
  if (user.self || user.kind !== "CHILD" || user.gender !== "FEMALE") return OFF;
  const { familyId } = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: user.id }, select: { familyId: true } });
  if (!familyId || !(await familyQadaAllowed(familyId))) return OFF;
  const adultId = typeof input.adultId === "string" ? input.adultId : "";
  const member = await prisma.familyMember.findUnique({ where: { familyId_userId: { familyId, userId: adultId } }, select: { userId: true } });
  if (!member) return OFF;
  const canSee = input.canSee === true;
  if (!mayChangeViewer(user.actorId, adultId, canSee)) return OFF;
  await prisma.familyExcuseViewer.upsert({
    where: { childId_adultId: { childId: user.id, adultId } },
    create: { childId: user.id, adultId, canSee },
    update: { canSee },
  });
  revalidatePath(`/rafiq/family/${familyId}`, "layout");
  return {};
}
