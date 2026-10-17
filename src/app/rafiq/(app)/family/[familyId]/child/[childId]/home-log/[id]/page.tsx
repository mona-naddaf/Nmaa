import { redirect } from "next/navigation";
import { familyEnabled } from "@/lib/family/enabled";
import { childForAdult } from "@/lib/family/child-pages";
import { getRafiqHomeLog } from "@/lib/rafiq/home-log";
import { rafiqMarkDetails, rafiqMarkFlags } from "@/lib/rafiq/home-mistakes";
import { FamilyPractice } from "../../../../../../home-log/[id]/FamilyPractice";
import { SimilarScope } from "../../../../../../SimilarScope";
import { ChildHeader } from "../../ChildHeader";

// An adult with edit rights practising one of a child's active passages with
// her: the counters, and marking her words (always — the child's own switch
// only limits the child), with letter/gap tajweed while her switch is on.
// View-only adults and anything else go back to the list.
export default async function AdultChildPracticePage({ params }: PageProps<"/rafiq/family/[familyId]/child/[childId]/home-log/[id]">) {
  if (!familyEnabled()) redirect("/rafiq");
  const { familyId, childId, id } = await params;
  const found = await childForAdult(familyId, childId);
  if (!found) redirect(`/rafiq/family/${familyId}`);
  const { access, child, viewer } = found;
  const base = `/rafiq/family/${access.family.id}/child/${child.id}`;
  if (!child.flags.homeLog) redirect(base);
  if (viewer !== "adult-edit") redirect(`${base}/home-log`);
  const log = await getRafiqHomeLog(child.id, { pastLimit: 0 });
  const segment = log.active.find((s) => s.id === id);
  if (!segment) redirect(`${base}/home-log`);
  const { surahNumber: s, fromAyah: from, toAyah: to } = segment;
  return (
    <>
      <ChildHeader familyId={access.family.id} child={child} canEdit on="home-log" you={access.user.gender} homeLog />
      <SimilarScope on={child.flags.mutashabihat} subjectId={child.id}>
        <FamilyPractice
          segment={segment}
          g={child.gender === "FEMALE" ? "GIRLS" : "BOYS"}
          listHref={`${base}/home-log`}
          viewer="adult-edit"
          subjectId={child.id}
          childName={child.name}
          you={access.user.gender}
          marks
          initialFlags={await rafiqMarkFlags(child.id, s, from, to)}
          detailInitial={child.flags.tajweed ? await rafiqMarkDetails(child.id, s, from, to) : null}
        />
      </SimilarScope>
    </>
  );
}
