import { requireRafiqUser } from "@/lib/rafiq/session";
import { getGoal, getPlan } from "@/lib/rafiq/memorization";
import { TEMPLATE_KEY_PLAN, type TemplateKey } from "@/lib/students/new-student";
import { guideEnabled } from "@/lib/guide/enabled";
import { planWelcome } from "@/lib/guide/lines";
import { PlanView } from "./PlanView";
import { WelcomeLine } from "../guide/WelcomeLine";
import { PointOnArrival } from "../guide/PointOnArrival";

const KEY_OF = Object.fromEntries(Object.entries(TEMPLATE_KEY_PLAN).map(([k, v]) => [v, k])) as Record<string, TemplateKey>;

// With guidance on: «خطتي» shows its own welcome line (the first setup, the
// empty plan of «أختار السور بنفسي» — ?from=start, which also starts that
// plan empty — or the page's own), and ?to=goal (the goal's intro line)
// points to «+ هدف للحفظ».
export default async function RafiqPlanPage({ searchParams }: PageProps<"/rafiq/plan">) {
  const user = await requireRafiqUser();
  const { planTemplate, plan } = await getPlan(user.id);
  const view = (
    <PlanView
      gender={user.gender}
      initialTemplate={planTemplate ? KEY_OF[planTemplate] : null}
      initialPlan={plan}
      goal={planTemplate ? await getGoal(user.id) : null}
      {...(guideEnabled() ? { guided: { startCustom: (await searchParams).from === "start" } } : {})}
    />
  );
  if (!guideEnabled()) return view;
  const sp = await searchParams;
  return (
    <>
      <WelcomeLine id={planWelcome({ hasPlan: planTemplate !== null, fromStart: sp.from === "start" })} />
      {sp.to === "goal" && planTemplate && <PointOnArrival target="plan.goal" />}
      {view}
    </>
  );
}
