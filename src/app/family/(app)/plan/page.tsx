import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireFamilyChild } from "@/lib/family/child-session";
import { childFlags, childHomeData } from "@/lib/family/child-pages";
import { ChildPlan } from "./ChildPlan";
import { resolveSubject } from "@/lib/rafiq/subject";
import { homeExcuse, subjectExcuse } from "@/lib/excuse/subject";
import { getCommitment } from "@/lib/rafiq/commitment";

// «خطتي» of a child («العائلة»): read only — the plan actions refuse a child
// on the server whatever this page shows (src/lib/rafiq/access-rules.ts).
export default async function ChildPlanPage() {
  const child = await requireFamilyChild();
  const flags = await childFlags(child.id);
  const [{ data }, { planTemplate }] = await Promise.all([
    childHomeData(child.id, flags),
    prisma.rafiqUser.findUniqueOrThrow({ where: { id: child.id }, select: { planTemplate: true } }),
  ]);
  if (!data) redirect("/family");
  // «أيام العذر»: her goal leaves her paused days out, as on «صفحتي»
  const me = await resolveSubject(null, "view");
  const excuse = "error" in me ? {} : await homeExcuse(child.id, await subjectExcuse(me), data, await getCommitment(child.id));
  return <ChildPlan data={data} template={planTemplate} gender={child.gender} {...excuse} />;
}
