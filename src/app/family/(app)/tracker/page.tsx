import { requireFamilyChild } from "@/lib/family/child-session";
import { childFlags, familyAdults } from "@/lib/family/child-pages";
import { getRafiqTracker } from "@/lib/rafiq/tracker";
import { rafiqPlace } from "@/lib/prayer/place-data";
import { RafiqTracker } from "@/app/rafiq/(app)/tracker/RafiqTracker";

// A child's «جدول المتابعة» («العائلة»): her own items (hers to change) and
// the ones her family's adults added (hers to tick, theirs to change); the
// daily agenda (times from the family's place) and summaries with their
// switches.
export default async function ChildTrackerPage() {
  const child = await requireFamilyChild();
  const flags = await childFlags(child.id);
  return (
    <RafiqTracker
      data={await getRafiqTracker(child.id)}
      g={child.gender === "FEMALE" ? "GIRLS" : "BOYS"}
      agenda={flags.agenda}
      place={flags.agenda ? await rafiqPlace(child.id) : null}
      celebrateKey={`family-child:${child.id}`}
      summaryHref={flags.summary ? "/family/tracker/summary" : undefined}
      scope={{ viewer: "child", adults: await familyAdults(child.familyId) }}
    />
  );
}
