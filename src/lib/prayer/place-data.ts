import "server-only";
import { prisma } from "@/lib/db";
import { locationOf, PLACE_SELECT } from "./location";
import type { PrayerLocation } from "./times";

/** A course's place for prayer times, or null (none set: anchors unavailable). */
export async function coursePlace(courseId: string): Promise<PrayerLocation | null> {
  return locationOf(await prisma.course.findUnique({ where: { id: courseId }, select: PLACE_SELECT }));
}

/** A «رفيق الحفظ» user's place, or null. «العائلة»: a child uses her family's place, set once for the family. */
export async function rafiqPlace(userId: string): Promise<PrayerLocation | null> {
  const row = await prisma.rafiqUser.findUnique({ where: { id: userId }, select: { ...PLACE_SELECT, kind: true, family: { select: PLACE_SELECT } } });
  return locationOf(row?.kind === "CHILD" ? row.family : row);
}
