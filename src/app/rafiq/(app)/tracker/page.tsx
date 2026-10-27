import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { getRafiqTracker } from "@/lib/rafiq/tracker";
import { RafiqTracker } from "./RafiqTracker";
import { rafiqPlace } from "@/lib/prayer/place-data";
import { familyEnabled } from "@/lib/family/enabled";
import { editableChildren } from "@/lib/family/tracker-copy-data";
import { getGuide } from "@/lib/guide/state";
import { introsFor } from "@/lib/guide/lines";
import { trackerIntroFacts } from "@/lib/guide/page-facts";
import { loadExcuses, ownExcuse } from "@/lib/excuse/rafiq-data";
import { addDays } from "@/lib/tracker/rules";

// With guidance on: the page's intro lines, and ?add=1 («إضافة بند» in
// «الخطوات الأولى») opens the new-item form straight away.
export default async function RafiqTrackerPage({ searchParams }: PageProps<"/rafiq/tracker">) {
  const user = await requireRafiqUser();
  const { agendaEnabled, summaryEnabled } = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: user.id }, select: { agendaEnabled: true, summaryEnabled: true } });
  // «العائلة»: «نسخ جدولي إلى…» — the children she may edit, in every family of hers
  const family = familyEnabled() ? (await editableChildren(user.id)).filter((f) => f.children.length > 0) : undefined;
  const guide = await getGuide();
  // «أيام العذر»: a woman's own (EXCUSE_ENABLED); nothing of it is loaded otherwise
  const excuse = await ownExcuse(user.id);
  return (
    <RafiqTracker
      data={await getRafiqTracker(user.id, undefined, excuse.show)}
      excuse={excuse.show ? { excuses: await loadExcuses(user.id, addDays(new Date().toISOString().slice(0, 10), -10)), on: excuse.on } : undefined}
      g={user.gender === "FEMALE" ? "GIRLS" : "BOYS"}
      agenda={agendaEnabled}
      summary={summaryEnabled}
      place={agendaEnabled ? await rafiqPlace(user.id) : null}
      celebrateKey={`rafiq:${user.id}`}
      family={family}
      guide={
        guide
          ? {
              intros: introsFor("tracker", { features: guide.facts.features, city: guide.facts.city, ...(await trackerIntroFacts(user.id)) }),
              add: (await searchParams).add === "1",
            }
          : undefined
      }
    />
  );
}
