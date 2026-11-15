import { GuideLink } from "@/components/guide/GuideLink";
import { redirect } from "next/navigation";
import { requireFamilyChild } from "@/lib/family/child-session";
import { childFlags } from "@/lib/family/child-pages";
import { RafiqSummary } from "@/app/rafiq/(app)/tracker/summary/RafiqSummary";
import hl from "@/components/home-log/home-log.module.css";

// A child's «المحصّلات» («العائلة»), only while the adults have them on.
export default async function ChildSummaryPage() {
  const child = await requireFamilyChild();
  if (!(await childFlags(child.id)).summary) redirect("/family/tracker");
  return (
    <div>
      <div className={hl.sectionTitle}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>📊 المحصّلات</span>
        <GuideLink href="/family/tracker" className={hl.linkBtn} name="summary.back">
          → جدول المتابعة
        </GuideLink>
      </div>
      <RafiqSummary g={child.gender === "FEMALE" ? "GIRLS" : "BOYS"} />
    </div>
  );
}
