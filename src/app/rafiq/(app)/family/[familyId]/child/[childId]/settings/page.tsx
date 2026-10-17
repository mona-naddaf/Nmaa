import { redirect } from "next/navigation";
import { familyEnabled } from "@/lib/family/enabled";
import { childForAdult } from "@/lib/family/child-pages";
import { currentCommitDays } from "@/lib/rafiq/commitment";
import { ChildHeader } from "../ChildHeader";
import { ChildSettings } from "./ChildSettings";

// «إعدادات {الاسم}»: a child's switches, commitment days and review
// reminders — changed by adults with edit rights, shown to view-only adults.
export default async function AdultChildSettingsPage({ params }: PageProps<"/rafiq/family/[familyId]/child/[childId]/settings">) {
  if (!familyEnabled()) redirect("/rafiq");
  const { familyId, childId } = await params;
  const found = await childForAdult(familyId, childId);
  if (!found) redirect(`/rafiq/family/${familyId}`);
  const { access, child, viewer } = found;
  return (
    <>
      <ChildHeader familyId={access.family.id} child={child} canEdit={viewer === "adult-edit"} on="settings" you={access.user.gender} homeLog={child.flags.homeLog} />
      <ChildSettings
        childId={child.id}
        name={child.name}
        gender={child.gender}
        canEdit={viewer === "adult-edit"}
        flags={child.flags}
        commitDays={await currentCommitDays(child.id)}
      />
    </>
  );
}
