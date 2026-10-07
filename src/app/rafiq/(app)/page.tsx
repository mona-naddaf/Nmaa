import { redirect } from "next/navigation";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { getMemorization } from "@/lib/rafiq/memorization";
import { RafiqHome } from "./RafiqHome";

// «صفحتي»: where she stands, her progress, recording a session, her
// mistakes, review reminders and her session history. Before she has a plan,
// she's sent to set one up.
export default async function RafiqHomePage() {
  const user = await requireRafiqUser();
  const data = await getMemorization(user.id);
  if (!data) redirect("/rafiq/plan");
  return <RafiqHome data={data} gender={user.gender} />;
}
