import { redirect } from "next/navigation";
import { requireFamilyChild } from "@/lib/family/child-session";
import { familyDashboardForChild } from "@/lib/family/dashboard";
import { FamilyDashboard } from "@/components/family/FamilyDashboard";
import hl from "@/components/home-log/home-log.module.css";

// «عائلتي» of a child (step 5): her siblings — only while the founder lets
// children see each other — and the adults who share. Her own family, from
// her own session; her own card is «صفحتي».
export default async function ChildFamilyPage() {
  const child = await requireFamilyChild();
  const data = await familyDashboardForChild(child.familyId, child.id);
  if (!data) redirect("/family");
  return (
    <div>
      <div className={hl.sectionTitle} style={{ margin: "0 4px 12px" }}>
        <span style={{ fontSize: 17, color: "var(--ink)" }}>عائلتي · {child.familyName}</span>
      </div>
      <FamilyDashboard data={data} viewer="child" />
    </div>
  );
}
