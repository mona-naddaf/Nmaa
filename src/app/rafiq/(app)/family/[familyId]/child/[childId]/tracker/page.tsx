import { redirect } from "next/navigation";
import { familyEnabled } from "@/lib/family/enabled";
import { childForAdult, familyAdults } from "@/lib/family/child-pages";
import { getRafiqTracker } from "@/lib/rafiq/tracker";
import { rafiqPlace } from "@/lib/prayer/place-data";
import { RafiqTracker } from "../../../../../tracker/RafiqTracker";
import { ChildHeader } from "../ChildHeader";
import { editableChildren } from "@/lib/family/tracker-copy-data";

// A child's «جدول المتابعة» for an adult of her family: view only, or — with
// edit rights — ticking for her and adding, changing and removing items
// (items an adult adds stay the adults' to change); the daily agenda and
// summaries with her switches.
export default async function AdultChildTrackerPage({ params }: PageProps<"/rafiq/family/[familyId]/child/[childId]/tracker">) {
  if (!familyEnabled()) redirect("/rafiq");
  const { familyId, childId } = await params;
  const found = await childForAdult(familyId, childId);
  if (!found) redirect(`/rafiq/family/${familyId}`);
  const { access, child, viewer } = found;
  const base = `/rafiq/family/${access.family.id}/child/${child.id}`;
  return (
    <>
      <ChildHeader familyId={access.family.id} child={child} canEdit={viewer === "adult-edit"} on="tracker" you={access.user.gender} homeLog={child.flags.homeLog} />
      <RafiqTracker
        data={await getRafiqTracker(child.id)}
        g={child.gender === "FEMALE" ? "GIRLS" : "BOYS"}
        agenda={child.flags.agenda}
        place={child.flags.agenda ? await rafiqPlace(child.id) : null}
        summaryHref={child.flags.summary ? `${base}/tracker/summary` : undefined}
        scope={{ viewer, subjectId: child.id, child: { name: child.name, gender: child.gender }, viewerId: access.user.id, adults: await familyAdults(access.family.id) }}
        // «إضافة إلى:» and «نسخ الجدول إلى…»: this family's children, for an adult with edit rights
        family={viewer === "adult-edit" ? (await editableChildren(access.user.id)).filter((f) => f.id === access.family.id) : undefined}
      />
    </>
  );
}
