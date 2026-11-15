import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { familyEnabled } from "@/lib/family/enabled";
import { childForAdult } from "@/lib/family/child-pages";
import { childGuideFacts } from "@/lib/family/guide";
import { getPlan } from "@/lib/rafiq/memorization";
import { listTemplates } from "@/lib/rafiq/templates";
import { startStep } from "@/lib/guide/family-keys";
import { ChildStartWizard } from "./ChildStartWizard";

// The child's start questions (the family guide, FAMILY_GUIDE_EMAILS): for an
// adult with edit rights, on a child added while the guide reaches the
// family. Everything is saved through the same actions as her pages, with
// her id; nothing here turns anything off.
export default async function ChildStartPage({ params }: PageProps<"/rafiq/family/[familyId]/child/[childId]/start">) {
  if (!familyEnabled()) notFound();
  const { familyId, childId } = await params;
  const found = await childForAdult(familyId, childId);
  if (!found || found.viewer !== "adult-edit") notFound();
  const facts = await childGuideFacts(found.child.id);
  if (!facts || !facts.isNew || facts.familyId !== found.access.family.id) notFound();
  const { access, child } = found;
  const adultId = access.user.id;

  const [{ planTemplate, plan }, row, priorSurahs, trackerItems, ownItems, siblings, family] = await Promise.all([
    getPlan(child.id),
    prisma.rafiqUser.findUniqueOrThrow({ where: { id: child.id }, select: { childCode: true, agendaEnabled: true, reviewReminderDays: true } }),
    prisma.rafiqSession.findMany({ where: { userId: child.id, source: "PRIOR" }, distinct: ["surahNumber"], select: { surahNumber: true } }).then((r) => r.length),
    prisma.rafiqTrackerItem.count({ where: { userId: child.id, archivedAt: null } }),
    prisma.rafiqTrackerItem.count({ where: { userId: adultId, archivedAt: null } }),
    // her brothers and sisters with items in their trackers («نسخ جدول موجود»)
    prisma.rafiqUser.findMany({
      where: { familyId: access.family.id, kind: "CHILD", id: { not: child.id } },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, _count: { select: { trackerItems: { where: { archivedAt: null } } } } },
    }),
    prisma.family.findUniqueOrThrow({ where: { id: access.family.id }, select: { prayerLat: true } }),
  ]);
  const bank = await listTemplates(adultId, "", row.agendaEnabled);

  return (
    <ChildStartWizard
      you={access.user.gender}
      child={{ id: child.id, name: child.name, gender: child.gender, code: row.childCode }}
      base={`/rafiq/family/${access.family.id}/child/${child.id}`}
      done={Object.hasOwn(facts.states, "childStart.done")}
      step={startStep(facts.states)}
      planTemplate={planTemplate}
      plan={plan}
      priorSurahs={priorSurahs}
      trackerItems={trackerItems}
      ownItems={ownItems}
      siblings={siblings.filter((s) => s._count.trackerItems > 0).map((s) => ({ id: s.id, name: s.name ?? "", items: s._count.trackerItems }))}
      switches={facts.switches}
      familyCity={family.prayerLat !== null}
      highlightReaches={facts.highlight}
      bank={bank.map((c) => ({ id: c.id, title: c.title, description: c.description, suggested: c.suggested, items: c.items.map((i) => ({ title: i.title, days: i.days })) }))}
    />
  );
}
