import { redirect } from "next/navigation";
import { requireParentStudentId } from "@/lib/auth/parent-session";
import { getParentViewData } from "@/lib/parent/data";
import { ParentView } from "./ParentView";
import { studentTimeZone } from "@/lib/time/course-zone";
import { TimeZoneProvider } from "@/lib/time/TimeZoneProvider";
import { parentGuideProps } from "@/lib/guide/course-guide";
import { CourseGuide } from "@/components/guide/course/CourseGuide";

export default async function ParentPage() {
  const studentId = await requireParentStudentId();
  const data = await getParentViewData(studentId);
  if (!data) redirect("/parent/login");
  // the guide (COURSE_GUIDE_EMAILS): null for every other course, which renders as before
  const guide = await parentGuideProps(studentId);
  // the course's days for the tracker and assignments (lib/time/zone.ts)
  return (
    <TimeZoneProvider timeZone={await studentTimeZone(studentId)}>
      {guide ? (
        <CourseGuide guide={guide}>
          <ParentView data={data} />
        </CourseGuide>
      ) : (
        <ParentView data={data} />
      )}
    </TimeZoneProvider>
  );
}
