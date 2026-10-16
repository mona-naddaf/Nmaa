import { redirect } from "next/navigation";
import { getRafiqUser } from "@/lib/rafiq/session";
import { RafiqLoginForm } from "./LoginForm";
import { familyEnabled } from "@/lib/family/enabled";
import { safeNext } from "@/lib/family/rules";

// ?next=: «العائلة» invite links opened while signed out (only the join page)
export default async function RafiqLoginPage({ searchParams }: PageProps<"/rafiq/login">) {
  const next = familyEnabled() ? safeNext((await searchParams).next) : null;
  if (await getRafiqUser()) redirect(next ?? "/rafiq");
  return <RafiqLoginForm next={next} />;
}
