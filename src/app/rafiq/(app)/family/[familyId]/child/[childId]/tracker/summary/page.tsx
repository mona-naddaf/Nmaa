import Link from "next/link";
import { redirect } from "next/navigation";
import { familyEnabled } from "@/lib/family/enabled";
import { childForAdult } from "@/lib/family/child-pages";
import hl from "@/components/home-log/home-log.module.css";
import { RafiqSummary } from "../../../../../../tracker/summary/RafiqSummary";
import { ChildHeader } from "../../ChildHeader";

// A child's «المحصّلات» for an adult of her family, while her switch is on.
export default async function AdultChildSummaryPage({ params }: PageProps<"/rafiq/family/[familyId]/child/[childId]/tracker/summary">) {
  if (!familyEnabled()) redirect("/rafiq");
  const { familyId, childId } = await params;
  const found = await childForAdult(familyId, childId);
  if (!found) redirect(`/rafiq/family/${familyId}`);
  const { access, child, viewer } = found;
  const base = `/rafiq/family/${access.family.id}/child/${child.id}`;
  if (!child.flags.summary) redirect(`${base}/tracker`);
  return (
    <>
      <ChildHeader familyId={access.family.id} child={child} canEdit={viewer === "adult-edit"} on="tracker" you={access.user.gender} homeLog={child.flags.homeLog} />
      <div className={hl.sectionTitle}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>📊 المحصّلات</span>
        <Link href={`${base}/tracker`} className={hl.linkBtn}>
          → جدول المتابعة
        </Link>
      </div>
      <RafiqSummary g={child.gender === "FEMALE" ? "GIRLS" : "BOYS"} subjectId={child.id} />
    </>
  );
}
