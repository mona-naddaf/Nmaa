import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { getPlan } from "@/lib/rafiq/memorization";
import { currentCommitDays } from "@/lib/rafiq/commitment";
import { listTemplates } from "@/lib/rafiq/templates";
import { locationOf, PLACE_SELECT } from "@/lib/prayer/location";
import { daysLabel } from "@/lib/tracker/rules";
import { guideEnabled } from "@/lib/guide/enabled";
import { getGuide } from "@/lib/guide/state";
import { StartWizard } from "./StartWizard";

// «أسئلة البداية» (src/lib/guide/wizard.ts): five questions that set up a new
// account, or anyone's after «إعادة أسئلة البداية». Only while guidance is on;
// an account from before (not new, no re-run) has nothing here.
export default async function RafiqStartPage() {
  if (!guideEnabled()) notFound();
  const user = await requireRafiqUser();
  const guide = await getGuide();
  if (!guide || !(guide.isNew || Object.hasOwn(guide.states, "wizard.rerun"))) notFound();

  const [{ planTemplate, plan }, row, priorSurahs, trackerItems, commitDays] = await Promise.all([
    getPlan(user.id),
    prisma.rafiqUser.findUniqueOrThrow({ where: { id: user.id }, select: { agendaEnabled: true, reviewReminderDays: true, ...PLACE_SELECT } }),
    // memorization from before, in surahs (a part of one counts as one)
    prisma.rafiqSession.findMany({ where: { userId: user.id, source: "PRIOR" }, distinct: ["surahNumber"], select: { surahNumber: true } }).then((r) => r.length),
    prisma.rafiqTrackerItem.count({ where: { userId: user.id, archivedAt: null } }),
    currentCommitDays(user.id),
  ]);
  const { agendaEnabled, reviewReminderDays, ...placeRow } = row;
  const bank = await listTemplates(user.id, "", agendaEnabled);
  const step = guide.states["wizard.step"];

  return (
    <StartWizard
      gender={user.gender}
      name={user.name}
      done={Object.hasOwn(guide.states, "wizard.done")}
      step={step && "q" in step ? step.q : null}
      planTemplate={planTemplate}
      plan={plan}
      priorSurahs={priorSurahs}
      commitDays={commitDays}
      commitLabel={daysLabel(commitDays)}
      trackerItems={trackerItems}
      agendaEnabled={agendaEnabled}
      place={locationOf(placeRow)}
      reviewDays={reviewReminderDays}
      bank={bank.map((c) => ({ id: c.id, title: c.title, description: c.description, suggested: c.suggested, items: c.items.map((i) => ({ title: i.title, days: i.days })) }))}
    />
  );
}
