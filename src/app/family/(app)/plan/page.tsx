import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireFamilyChild } from "@/lib/family/child-session";
import { childFlags, childHomeData } from "@/lib/family/child-pages";
import { ChildPlan } from "./ChildPlan";

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
  return <ChildPlan data={data} template={planTemplate} gender={child.gender} />;
}
