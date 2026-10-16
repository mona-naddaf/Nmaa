import { redirect } from "next/navigation";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { familyEnabled } from "@/lib/family/enabled";
import { JoinFamilyForm } from "../FamilyForms";

// ?code= comes from an invite link («نسخ رابط الدعوة»); signed-out visitors
// are sent through login or sign-up and back here (src/lib/family/rules.ts
// safeNext).
export default async function JoinFamilyPage({ searchParams }: PageProps<"/rafiq/family/join">) {
  if (!familyEnabled()) redirect("/rafiq");
  const user = await requireRafiqUser();
  const { code } = await searchParams;
  const prefill = typeof code === "string" ? code.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12) : "";
  return <JoinFamilyForm gender={user.gender} needsName={!user.name} code={prefill} />;
}
