import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { SettingsView } from "./SettingsView";
import { locationOf, PLACE_SELECT } from "@/lib/prayer/location";
import { currentCommitDays } from "@/lib/rafiq/commitment";

export default async function RafiqSettingsPage() {
  const user = await requireRafiqUser();
  const { recoveryCodeCreatedAt, reviewReminderDays, agendaEnabled, summaryEnabled, mutashabihatEnabled, tajweedDetailEnabled, ...placeRow } = await prisma.rafiqUser.findUniqueOrThrow({
    where: { id: user.id },
    select: { recoveryCodeCreatedAt: true, reviewReminderDays: true, agendaEnabled: true, summaryEnabled: true, mutashabihatEnabled: true, tajweedDetailEnabled: true, ...PLACE_SELECT },
  });
  return (
    <SettingsView
      email={user.email}
      name={user.name}
      gender={user.gender}
      // always set for an adult (RafiqUser_kind_shape_check); only a child has none
      recoveryCodeCreatedAt={(recoveryCodeCreatedAt ?? new Date(0)).toISOString()}
      reviewReminderDays={reviewReminderDays}
      agendaEnabled={agendaEnabled}
      summaryEnabled={summaryEnabled}
      similarEnabled={mutashabihatEnabled}
      tajweedEnabled={tajweedDetailEnabled}
      place={locationOf(placeRow)}
      commitDays={await currentCommitDays(user.id)}
    />
  );
}
