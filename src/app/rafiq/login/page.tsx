import { redirect } from "next/navigation";
import { getRafiqUser } from "@/lib/rafiq/session";
import { RafiqLoginForm } from "./LoginForm";

export default async function RafiqLoginPage() {
  if (await getRafiqUser()) redirect("/rafiq");
  return <RafiqLoginForm />;
}
