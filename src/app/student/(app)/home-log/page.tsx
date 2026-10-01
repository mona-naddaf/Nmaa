import { redirect } from "next/navigation";
import { requireStudentAccess } from "@/lib/auth/student-session";
import { getHomeLog } from "@/lib/home-log/data";
import { getPlanAndPosition } from "@/lib/student-portal/data";
import { nextExpectedEntry } from "@/lib/recitation/logic";
import { HomeLogHome } from "./HomeLogHome";

// «حفظي في البيت»: her segments and the "new segment" form. Refused (not
// just hidden) when the course has the home log off.
export default async function HomeLogPage() {
  const { studentId, homeLogEnabled } = await requireStudentAccess();
  if (!homeLogEnabled) redirect("/student");

  const [log, { plan, position, groupGender }] = await Promise.all([getHomeLog(studentId), getPlanAndPosition(studentId)]);
  // default: the portion right after her official position in her plan
  const suggestion = nextExpectedEntry(plan, position);

  return <HomeLogHome log={log} groupGender={groupGender} plan={plan} suggestion={suggestion} />;
}
