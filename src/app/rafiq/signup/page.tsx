import { getRafiqUser } from "@/lib/rafiq/session";
import { SignupForm } from "./SignupForm";
import { familyEnabled } from "@/lib/family/enabled";
import { safeNext } from "@/lib/family/rules";

// Not a redirect when signed in: signing up sets the session cookie, which
// re-renders this page, and the new recovery رمز must still be shown.
// ?next=: «العائلة» invite links and the home page's card (the join page and
// «عائلاتي» only), after the recovery رمز
export default async function RafiqSignupPage({ searchParams }: PageProps<"/rafiq/signup">) {
  const next = familyEnabled() ? safeNext((await searchParams).next) : null;
  return <SignupForm signedIn={!!(await getRafiqUser())} next={next} />;
}
