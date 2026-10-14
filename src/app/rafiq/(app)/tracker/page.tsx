import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { getRafiqTracker } from "@/lib/rafiq/tracker";
import { RafiqTracker } from "./RafiqTracker";
import { rafiqPlace } from "@/lib/prayer/place-data";

export default async function RafiqTrackerPage() {
  const user = await requireRafiqUser();
  const { agendaEnabled, summaryEnabled } = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: user.id }, select: { agendaEnabled: true, summaryEnabled: true } });
  return <RafiqTracker data={await getRafiqTracker(user.id)} g={user.gender === "FEMALE" ? "GIRLS" : "BOYS"} agenda={agendaEnabled} summary={summaryEnabled} place={agendaEnabled ? await rafiqPlace(user.id) : null} />;
}
