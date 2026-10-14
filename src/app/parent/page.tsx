import { redirect } from "next/navigation";
import { requireParentStudentId } from "@/lib/auth/parent-session";
import { getParentViewData } from "@/lib/parent/data";
import { ParentView } from "./ParentView";
import { studentTimeZone } from "@/lib/time/course-zone";
import { TimeZoneProvider } from "@/lib/time/TimeZoneProvider";

export default async function ParentPage() {
  const studentId = await requireParentStudentId();
  const data = await getParentViewData(studentId);
  if (!data) redirect("/parent/login");
  // the course's days for the tracker and assignments (lib/time/zone.ts)
  return (
    <TimeZoneProvider timeZone={await studentTimeZone(studentId)}>
      <ParentView data={data} />
    </TimeZoneProvider>
  );
}
