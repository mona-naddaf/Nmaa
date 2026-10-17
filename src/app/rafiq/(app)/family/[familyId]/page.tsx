import { redirect } from "next/navigation";
import { familyEnabled } from "@/lib/family/enabled";
import { familyAccess, familyView } from "@/lib/family/data";
import { FamilyView } from "./FamilyView";
import { familyDashboardForAdult } from "@/lib/family/dashboard";

// One family: its adults, the founder's invite رموز and settings. Anyone who
// isn't (or is no longer) a member goes back to «عائلاتي».
export default async function FamilyPage({ params }: PageProps<"/rafiq/family/[familyId]">) {
  if (!familyEnabled()) redirect("/rafiq");
  const { familyId } = await params;
  const access = await familyAccess(familyId);
  if ("error" in access) redirect("/rafiq/family?list=1");
  const [view, dashboard] = await Promise.all([familyView(access), familyDashboardForAdult(access.family.id, access.user.id)]);
  return <FamilyView view={view} gender={access.user.gender} dashboard={dashboard} />;
}
