import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { getRafiqTracker } from "@/lib/rafiq/tracker";
import { RafiqTracker } from "./RafiqTracker";
import { rafiqPlace } from "@/lib/prayer/place-data";
import { familyEnabled } from "@/lib/family/enabled";
import { editableChildren } from "@/lib/family/tracker-copy-data";

export default async function RafiqTrackerPage() {
  const user = await requireRafiqUser();
  const { agendaEnabled, summaryEnabled } = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: user.id }, select: { agendaEnabled: true, summaryEnabled: true } });
  // «العائلة»: «نسخ جدولي إلى…» — the children she may edit, in every family of hers
  const family = familyEnabled() ? (await editableChildren(user.id)).filter((f) => f.children.length > 0) : undefined;
  return (
    <RafiqTracker
      data={await getRafiqTracker(user.id)}
      g={user.gender === "FEMALE" ? "GIRLS" : "BOYS"}
      agenda={agendaEnabled}
      summary={summaryEnabled}
      place={agendaEnabled ? await rafiqPlace(user.id) : null}
      celebrateKey={`rafiq:${user.id}`}
      family={family}
    />
  );
}
