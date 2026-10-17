import { redirect } from "next/navigation";
import { requireFamilyChild } from "@/lib/family/child-session";
import { childFlags } from "@/lib/family/child-pages";
import { getMemorization } from "@/lib/rafiq/memorization";
import { getRafiqHomeLog, getRafiqTargets } from "@/lib/rafiq/home-log";
import { nextExpectedEntry } from "@/lib/recitation/logic";
import { RafiqHomeLog } from "@/app/rafiq/(app)/home-log/RafiqHomeLog";
import { SimilarScope } from "@/app/rafiq/(app)/SimilarScope";

// A child's «حفظي في البيت» («العائلة»), only while the adults have it on:
// her passages (she adds them and taps the counters herself); the targets are
// the adults' to set.
export default async function ChildHomeLogPage() {
  const child = await requireFamilyChild();
  const flags = await childFlags(child.id);
  if (!flags.homeLog) redirect("/family");
  const memorization = await getMemorization(child.id);
  if (!memorization) redirect("/family");
  const [log, targets] = await Promise.all([getRafiqHomeLog(child.id), getRafiqTargets(child.id)]);
  return (
    <SimilarScope on={flags.mutashabihat} subjectId="">
      <RafiqHomeLog
        log={log}
        g={child.gender === "FEMALE" ? "GIRLS" : "BOYS"}
        plan={memorization.plan}
        suggestion={nextExpectedEntry(memorization.plan, memorization.position)}
        targets={targets}
        viewer="child"
        base="/family/home-log"
      />
    </SimilarScope>
  );
}
