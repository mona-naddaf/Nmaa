import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { SettingsView } from "./SettingsView";
import { locationOf, PLACE_SELECT } from "@/lib/prayer/location";
import { currentCommitDays } from "@/lib/rafiq/commitment";

export default async function RafiqSettingsPage() {
  const user = await requireRafiqUser();
  const { recoveryCodeCreatedAt, reviewReminderDays, agendaEnabled, summaryEnabled, mutashabihatEnabled, ...placeRow } = await prisma.rafiqUser.findUniqueOrThrow({
    where: { id: user.id },
    select: { recoveryCodeCreatedAt: true, reviewReminderDays: true, agendaEnabled: true, summaryEnabled: true, mutashabihatEnabled: true, ...PLACE_SELECT },
  });
  return (
    <SettingsView
      email={user.email}
      name={user.name}
      gender={user.gender}
      recoveryCodeCreatedAt={recoveryCodeCreatedAt.toISOString()}
      reviewReminderDays={reviewReminderDays}
      agendaEnabled={agendaEnabled}
      summaryEnabled={summaryEnabled}
      similarEnabled={mutashabihatEnabled}
      place={locationOf(placeRow)}
      commitDays={await currentCommitDays(user.id)}
    />
  );
}
