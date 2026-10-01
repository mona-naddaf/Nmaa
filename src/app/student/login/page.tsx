import { redirect } from "next/navigation";
import { getStudentAccess } from "@/lib/auth/student-session";
import { StudentLoginForm } from "./StudentLoginForm";

export default async function StudentLoginPage() {
  if (await getStudentAccess()) redirect("/student");
  return <StudentLoginForm />;
}
