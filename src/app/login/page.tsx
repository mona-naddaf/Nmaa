import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (session) {
    redirect("/students");
  }
  // The homepage's supervisor card links here with ?role=supervisor.
  const { role } = await searchParams;
  return <LoginForm initialView={role === "supervisor" ? "admin" : "teacher"} />;
}
