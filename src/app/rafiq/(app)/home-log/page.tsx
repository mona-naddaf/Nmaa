import { redirect } from "next/navigation";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { getMemorization } from "@/lib/rafiq/memorization";
import { getRafiqHomeLog, getRafiqTargets } from "@/lib/rafiq/home-log";
import { nextExpectedEntry } from "@/lib/recitation/logic";
import { RafiqHomeLog } from "./RafiqHomeLog";

export default async function RafiqHomeLogPage() {
  const user = await requireRafiqUser();
  const memorization = await getMemorization(user.id);
  if (!memorization) redirect("/rafiq/plan");
  const [log, targets] = await Promise.all([getRafiqHomeLog(user.id), getRafiqTargets(user.id)]);
  return (
    <RafiqHomeLog
      log={log}
      g={user.gender === "FEMALE" ? "GIRLS" : "BOYS"}
      plan={memorization.plan}
      // default: the portion right after her position in her plan
      suggestion={nextExpectedEntry(memorization.plan, memorization.position)}
      targets={targets}
    />
  );
}
