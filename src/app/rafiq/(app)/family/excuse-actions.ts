"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { resolveSubject } from "@/lib/rafiq/subject";
import { safeTimeZone } from "@/lib/time/zone";
import { endOnSwitchOff } from "@/lib/excuse/rafiq-data";
import { familyExcuseAllowed } from "@/lib/excuse/family-data";
import { mayChangeViewer } from "@/lib/excuse/visibility";
import { NOT_AVAILABLE } from "@/lib/family/data";

// «أيام العذر» on a girl's settings page («العائلة»): her 10th switch and
// her list of the adults who see it. Both for the founder and adults with
// edit rights only, as her other switches.

type State = { error?: string };

// (the switches show their own message on any failure)
const OFF = { error: NOT_AVAILABLE };

/** The girl, when the one asking may change her switches and the feature reaches her family. */
async function girl(childId: unknown) {
  const user = await resolveSubject(childId, "manage");
  if ("error" in user) return user;
  if (user.self || user.kind !== "CHILD" || user.gender !== "FEMALE") return OFF;
  const { familyId } = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: user.id }, select: { familyId: true } });
  if (!familyId || !(await familyExcuseAllowed(familyId))) return OFF;
  return { ...user, familyId };
}

function refresh(familyId: string) {
  revalidatePath(`/rafiq/family/${familyId}`, "layout");
}

/** F1: on or off (off by default). Off ends an open excuse now (A4), in the adult's time zone. */
export async function setChildExcuseAction(input: { childId: string; on: boolean; zone: unknown }): Promise<State> {
  const child = await girl(input?.childId);
  if ("error" in child) return child;
  const on = input.on === true;
  if (!on) await endOnSwitchOff(child.id, safeTimeZone(typeof input.zone === "string" ? input.zone : null), { adultId: child.actorId });
  await prisma.rafiqUser.update({ where: { id: child.id }, data: { excuseEnabled: on } });
  refresh(child.familyId);
  return {};
}

/** F5: whether one adult of her family sees her excuse (and may start and end it). Never checking oneself. */
export async function setExcuseViewerAction(input: { childId: string; adultId: string; canSee: boolean }): Promise<State> {
  const child = await girl(input?.childId);
  if ("error" in child) return child;
  const adultId = typeof input.adultId === "string" ? input.adultId : "";
  const member = await prisma.familyMember.findUnique({ where: { familyId_userId: { familyId: child.familyId, userId: adultId } }, select: { userId: true } });
  if (!member) return OFF;
  const canSee = input.canSee === true;
  if (!mayChangeViewer(child.actorId, adultId, canSee)) return OFF;
  await prisma.familyExcuseViewer.upsert({
    where: { childId_adultId: { childId: child.id, adultId } },
    create: { childId: child.id, adultId, canSee },
    update: { canSee },
  });
  refresh(child.familyId);
  return {};
}
