import { prisma } from "@/lib/db";
import { requireFamilyChild } from "@/lib/family/child-session";
import { familyAdults } from "@/lib/family/child-pages";
import { getRafiqTracker } from "@/lib/rafiq/tracker";
import { RafiqTracker } from "@/app/rafiq/(app)/tracker/RafiqTracker";

// A child's «جدول المتابعة» («العائلة»): her own items (hers to change) and
// the ones her family's adults added (hers to tick, theirs to change).
export default async function ChildTrackerPage() {
  const child = await requireFamilyChild();
  const { agendaEnabled } = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: child.id }, select: { agendaEnabled: true } });
  return (
    <RafiqTracker
      data={await getRafiqTracker(child.id)}
      g={child.gender === "FEMALE" ? "GIRLS" : "BOYS"}
      agenda={agendaEnabled}
      celebrateKey={`family-child:${child.id}`}
      scope={{ viewer: "child", adults: await familyAdults(child.familyId) }}
    />
  );
}
