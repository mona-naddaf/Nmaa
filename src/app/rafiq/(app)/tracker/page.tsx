import { requireRafiqUser } from "@/lib/rafiq/session";
import { getRafiqTracker } from "@/lib/rafiq/tracker";
import { RafiqTracker } from "./RafiqTracker";

export default async function RafiqTrackerPage() {
  const user = await requireRafiqUser();
  return <RafiqTracker data={await getRafiqTracker(user.id)} g={user.gender === "FEMALE" ? "GIRLS" : "BOYS"} />;
}
