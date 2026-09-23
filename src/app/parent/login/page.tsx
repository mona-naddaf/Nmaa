import { redirect } from "next/navigation";
import { getParentStudentId } from "@/lib/auth/parent-session";
import { ParentLoginForm } from "./ParentLoginForm";

export default async function ParentLoginPage() {
  if (await getParentStudentId()) redirect("/parent");
  return <ParentLoginForm />;
}
