import { redirect } from "next/navigation";
import { requireStudentAccess } from "@/lib/auth/student-session";
import { getStudentHomeData } from "@/lib/student-portal/data";
import { StudentHome } from "./StudentHome";

export default async function StudentHomePage() {
  const { studentId } = await requireStudentAccess();
  const data = await getStudentHomeData(studentId);
  if (!data) redirect("/student/login");
  return <StudentHome data={data} />;
}
