import { redirect } from "next/navigation";
import { familyEnabled } from "@/lib/family/enabled";
import { childForAdult } from "@/lib/family/child-pages";
import { getMemorization } from "@/lib/rafiq/memorization";
import { getRafiqHomeLog, getRafiqTargets } from "@/lib/rafiq/home-log";
import { nextExpectedEntry } from "@/lib/recitation/logic";
import { RafiqHomeLog } from "../../../../../home-log/RafiqHomeLog";
import { SimilarScope } from "../../../../../SimilarScope";
import { ChildHeader } from "../ChildHeader";

// A child's «حفظي في البيت» for an adult of her family, while her switch is
// on: with edit rights, adding passages for her, practising with her and
// setting her targets; view only, the cards.
export default async function AdultChildHomeLogPage({ params }: PageProps<"/rafiq/family/[familyId]/child/[childId]/home-log">) {
  if (!familyEnabled()) redirect("/rafiq");
  const { familyId, childId } = await params;
  const found = await childForAdult(familyId, childId);
  if (!found) redirect(`/rafiq/family/${familyId}`);
  const { access, child, viewer } = found;
  const base = `/rafiq/family/${access.family.id}/child/${child.id}`;
  if (!child.flags.homeLog) redirect(base);
  const memorization = await getMemorization(child.id);
  if (!memorization) redirect(base);
  const [log, targets] = await Promise.all([getRafiqHomeLog(child.id), getRafiqTargets(child.id)]);
  return (
    <>
      <ChildHeader familyId={access.family.id} child={child} canEdit={viewer === "adult-edit"} on="home-log" you={access.user.gender} homeLog />
      <SimilarScope on={child.flags.mutashabihat} subjectId={child.id}>
        <RafiqHomeLog
          log={log}
          g={child.gender === "FEMALE" ? "GIRLS" : "BOYS"}
          plan={memorization.plan}
          suggestion={nextExpectedEntry(memorization.plan, memorization.position)}
          targets={targets}
          viewer={viewer}
          subjectId={child.id}
          base={`${base}/home-log`}
          childName={child.name}
          you={access.user.gender}
        />
      </SimilarScope>
    </>
  );
}
