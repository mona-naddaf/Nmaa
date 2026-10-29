import { requireFamilyChild } from "@/lib/family/child-session";
import { childFlags, familyAdults } from "@/lib/family/child-pages";
import { getRafiqTracker } from "@/lib/rafiq/tracker";
import { rafiqPlace } from "@/lib/prayer/place-data";
import { RafiqTracker } from "@/app/rafiq/(app)/tracker/RafiqTracker";
import { resolveSubject } from "@/lib/rafiq/subject";
import { subjectExcuse, trackerExcuse } from "@/lib/excuse/subject";

// A child's «جدول المتابعة» («العائلة»): her own items (hers to change) and
// the ones her family's adults added (hers to tick, theirs to change); the
// daily agenda (times from the family's place) and summaries with their
// switches.
export default async function ChildTrackerPage() {
  const child = await requireFamilyChild();
  const flags = await childFlags(child.id);
  // «أيام العذر»: a girl's own, where it reaches her family
  const me = await resolveSubject(null, "view");
  const ex = "error" in me ? null : await subjectExcuse(me);
  return (
    <RafiqTracker
      data={await getRafiqTracker(child.id, undefined, ex?.show === true)}
      excuse={ex ? await trackerExcuse(child.id, ex, { name: child.name, adultPage: false }) : undefined}
      g={child.gender === "FEMALE" ? "GIRLS" : "BOYS"}
      agenda={flags.agenda}
      place={flags.agenda ? await rafiqPlace(child.id) : null}
      celebrateKey={`family-child:${child.id}`}
      summaryHref={flags.summary ? "/family/tracker/summary" : undefined}
      scope={{ viewer: "child", adults: await familyAdults(child.familyId) }}
    />
  );
}
