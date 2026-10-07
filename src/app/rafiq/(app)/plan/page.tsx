import { requireRafiqUser } from "@/lib/rafiq/session";
import { getPlan } from "@/lib/rafiq/memorization";
import { TEMPLATE_KEY_PLAN, type TemplateKey } from "@/lib/students/new-student";
import { PlanView } from "./PlanView";

const KEY_OF = Object.fromEntries(Object.entries(TEMPLATE_KEY_PLAN).map(([k, v]) => [v, k])) as Record<string, TemplateKey>;

export default async function RafiqPlanPage() {
  const user = await requireRafiqUser();
  const { planTemplate, plan } = await getPlan(user.id);
  return <PlanView gender={user.gender} initialTemplate={planTemplate ? KEY_OF[planTemplate] : null} initialPlan={plan} />;
}
