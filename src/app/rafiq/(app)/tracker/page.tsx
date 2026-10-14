import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { getRafiqTracker } from "@/lib/rafiq/tracker";
import { RafiqTracker } from "./RafiqTracker";

export default async function RafiqTrackerPage() {
  const user = await requireRafiqUser();
  const { agendaEnabled } = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: user.id }, select: { agendaEnabled: true } });
  return <RafiqTracker data={await getRafiqTracker(user.id)} g={user.gender === "FEMALE" ? "GIRLS" : "BOYS"} agenda={agendaEnabled} />;
}
