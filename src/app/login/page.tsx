import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(session.role === "admin" ? "/settings" : "/students");
  }
  return <LoginForm />;
}
