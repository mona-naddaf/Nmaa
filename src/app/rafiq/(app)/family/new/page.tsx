import { redirect } from "next/navigation";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { familyEnabled } from "@/lib/family/enabled";
import { CreateFamilyForm } from "../FamilyForms";

export default async function NewFamilyPage() {
  if (!familyEnabled()) redirect("/rafiq");
  const user = await requireRafiqUser();
  return <CreateFamilyForm gender={user.gender} needsName={!user.name} />;
}
