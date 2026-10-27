import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { SettingsView } from "./SettingsView";
import { locationOf, PLACE_SELECT } from "@/lib/prayer/location";
import { currentCommitDays } from "@/lib/rafiq/commitment";
import { getGuide } from "@/lib/guide/state";
import { checklistComplete } from "@/lib/guide/lines";
import { checklistFacts } from "@/lib/guide/page-facts";
import { ownExcuse } from "@/lib/excuse/rafiq-data";

export default async function RafiqSettingsPage() {
  const user = await requireRafiqUser();
  const { recoveryCodeCreatedAt, reviewReminderDays, agendaEnabled, summaryEnabled, mutashabihatEnabled, tajweedDetailEnabled, ...placeRow } = await prisma.rafiqUser.findUniqueOrThrow({
    where: { id: user.id },
    select: { recoveryCodeCreatedAt: true, reviewReminderDays: true, agendaEnabled: true, summaryEnabled: true, mutashabihatEnabled: true, tajweedDetailEnabled: true, ...PLACE_SELECT },
  });
  // guidance on, a new account: whether «إظهار الإرشادات من جديد» brings her checklist back
  const guide = await getGuide();
  const done = guide?.isNew ? checklistComplete(await checklistFacts(user.id), guide.states) : null;
  // «أيام العذر»: a woman's own switch (EXCUSE_ENABLED); A4 shows while an excuse is open
  const excuse = await ownExcuse(user.id);
  const open = excuse.show && (await prisma.rafiqExcuse.count({ where: { userId: user.id, endDay: null } })) > 0;
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
      {...(guide ? { guide: { checklistComplete: done ?? false } } : {})}
      {...(excuse.show ? { excuse: { enabled: excuse.on, active: open } } : {})}
    />
  );
}
