import { redirect } from "next/navigation";
import { familyEnabled } from "@/lib/family/enabled";
import { childForAdult, familyAdults } from "@/lib/family/child-pages";
import { getRafiqTracker } from "@/lib/rafiq/tracker";
import { RafiqTracker } from "../../../../../tracker/RafiqTracker";
import { ChildHeader } from "../ChildHeader";

// A child's «جدول المتابعة» for an adult of her family: view only, or — with
// edit rights — ticking for her and adding, changing and removing items
// (items an adult adds stay the adults' to change).
export default async function AdultChildTrackerPage({ params }: PageProps<"/rafiq/family/[familyId]/child/[childId]/tracker">) {
  if (!familyEnabled()) redirect("/rafiq");
  const { familyId, childId } = await params;
  const found = await childForAdult(familyId, childId);
  if (!found) redirect(`/rafiq/family/${familyId}`);
  const { access, child, viewer } = found;
  return (
    <>
      <ChildHeader familyId={access.family.id} child={child} canEdit={viewer === "adult-edit"} on="tracker" you={access.user.gender} />
      <RafiqTracker
        data={await getRafiqTracker(child.id)}
        g={child.gender === "FEMALE" ? "GIRLS" : "BOYS"}
        agenda={child.agendaEnabled}
        scope={{ viewer, subjectId: child.id, child: { name: child.name, gender: child.gender }, viewerId: access.user.id, adults: await familyAdults(access.family.id) }}
      />
    </>
  );
}
