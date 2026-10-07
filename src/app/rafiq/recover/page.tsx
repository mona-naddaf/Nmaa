import { getRafiqUser } from "@/lib/rafiq/session";
import { RecoverForm } from "./RecoverForm";

// Not a redirect when signed in: a successful recovery signs her in, which
// re-renders this page, and the new recovery رمز must still be shown.
export default async function RafiqRecoverPage() {
  return <RecoverForm signedIn={!!(await getRafiqUser())} />;
}
