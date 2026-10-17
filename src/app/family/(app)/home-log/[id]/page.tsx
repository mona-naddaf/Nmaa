import { redirect } from "next/navigation";
import { requireFamilyChild } from "@/lib/family/child-session";
import { childFlags } from "@/lib/family/child-pages";
import { getRafiqHomeLog } from "@/lib/rafiq/home-log";
import { rafiqMarkDetails, rafiqMarkFlags } from "@/lib/rafiq/home-mistakes";
import { FamilyPractice } from "@/app/rafiq/(app)/home-log/[id]/FamilyPractice";
import { SimilarScope } from "@/app/rafiq/(app)/SimilarScope";

// One active passage of a child («العائلة»), for the child herself: the
// counters, and — with her «تحديد أخطائي في البيت» switch — marking her words
// (and their tajweed detail with that switch too). Anything else goes back.
export default async function ChildPracticePage({ params }: PageProps<"/family/home-log/[id]">) {
  const { id } = await params;
  const child = await requireFamilyChild();
  const flags = await childFlags(child.id);
  if (!flags.homeLog) redirect("/family");
  const log = await getRafiqHomeLog(child.id, { pastLimit: 0 });
  const segment = log.active.find((s) => s.id === id);
  if (!segment) redirect("/family/home-log");
  const { surahNumber: s, fromAyah: from, toAyah: to } = segment;
  return (
    <SimilarScope on={flags.mutashabihat} subjectId="">
      <FamilyPractice
        segment={segment}
        g={child.gender === "FEMALE" ? "GIRLS" : "BOYS"}
        listHref="/family/home-log"
        viewer="child"
        childName={child.name}
        marks={flags.homeMistakes}
        initialFlags={flags.homeMistakes ? await rafiqMarkFlags(child.id, s, from, to) : {}}
        detailInitial={flags.homeMistakes && flags.tajweed ? await rafiqMarkDetails(child.id, s, from, to) : null}
      />
    </SimilarScope>
  );
}
