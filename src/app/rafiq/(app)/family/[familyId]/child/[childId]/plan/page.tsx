import { redirect } from "next/navigation";
import { familyEnabled } from "@/lib/family/enabled";
import { childForAdult, childHomeData } from "@/lib/family/child-pages";
import { getGoal, getPlan } from "@/lib/rafiq/memorization";
import { TEMPLATE_KEY_PLAN, type TemplateKey } from "@/lib/students/new-student";
import { PlanView } from "../../../../../plan/PlanView";
import { ChildPlan } from "@/app/family/(app)/plan/ChildPlan";
import { ChildHeader } from "../ChildHeader";

const KEY_OF = Object.fromEntries(Object.entries(TEMPLATE_KEY_PLAN).map(([k, v]) => [v, k])) as Record<string, TemplateKey>;

// A child's plan for an adult of her family: with edit rights the Rafiq plan
// page (template, order, previous memorization, and her goal with its
// switch); view only, the same read-only plan the child sees.
export default async function AdultChildPlanPage({ params }: PageProps<"/rafiq/family/[familyId]/child/[childId]/plan">) {
  if (!familyEnabled()) redirect("/rafiq");
  const { familyId, childId } = await params;
  const found = await childForAdult(familyId, childId);
  if (!found) redirect(`/rafiq/family/${familyId}`);
  const { access, child, viewer } = found;
  const header = (
    <ChildHeader familyId={access.family.id} child={child} canEdit={viewer === "adult-edit"} on="plan" you={access.user.gender} homeLog={child.flags.homeLog} />
  );
  const { planTemplate, plan } = await getPlan(child.id);
  if (viewer === "adult-view") {
    const { data } = await childHomeData(child.id, child.flags);
    return (
      <>
        {header}
        {data && <ChildPlan data={data} template={planTemplate} gender={child.gender} about={child.name} />}
      </>
    );
  }
  return (
    <>
      {header}
      <PlanView
        gender={access.user.gender}
        initialTemplate={planTemplate ? KEY_OF[planTemplate] : null}
        initialPlan={plan}
        goal={child.flags.goal && planTemplate ? await getGoal(child.id) : null}
        subjectId={child.id}
        child={{ name: child.name, gender: child.gender }}
        goalEnabled={child.flags.goal}
      />
    </>
  );
}
