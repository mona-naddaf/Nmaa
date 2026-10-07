import { getRafiqUser } from "@/lib/rafiq/session";
import { SignupForm } from "./SignupForm";

// Not a redirect when signed in: signing up sets the session cookie, which
// re-renders this page, and the new recovery رمز must still be shown.
export default async function RafiqSignupPage() {
  return <SignupForm signedIn={!!(await getRafiqUser())} />;
}
