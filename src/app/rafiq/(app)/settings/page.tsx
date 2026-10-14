import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { SettingsView } from "./SettingsView";
import { currentCommitDays } from "@/lib/rafiq/commitment";

export default async function RafiqSettingsPage() {
  const user = await requireRafiqUser();
  const { recoveryCodeCreatedAt, reviewReminderDays, agendaEnabled, summaryEnabled } = await prisma.rafiqUser.findUniqueOrThrow({
    where: { id: user.id },
    select: { recoveryCodeCreatedAt: true, reviewReminderDays: true, agendaEnabled: true, summaryEnabled: true },
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
      commitDays={await currentCommitDays(user.id)}
    />
  );
}
