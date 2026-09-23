import { redirect } from "next/navigation";
import { requireParentStudentId } from "@/lib/auth/parent-session";
import { getParentViewData } from "@/lib/parent/data";
import { ParentView } from "./ParentView";

export default async function ParentPage() {
  const studentId = await requireParentStudentId();
  const data = await getParentViewData(studentId);
  if (!data) redirect("/parent/login");
  return <ParentView data={data} />;
}
