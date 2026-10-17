import { redirect } from "next/navigation";
import { familyEnabled } from "@/lib/family/enabled";
import { getFamilyChild } from "@/lib/family/child-session";
import { ChildLoginForm } from "./ChildLoginForm";

export default async function ChildLoginPage() {
  if (!familyEnabled()) redirect("/");
  if (await getFamilyChild()) redirect("/family");
  return <ChildLoginForm />;
}
