import { redirect } from "next/navigation";
import { familyEnabled } from "@/lib/family/enabled";
import { childForAdult, childHomeData, familyAdults } from "@/lib/family/child-pages";
import { RafiqHome } from "../../../../RafiqHome";
import hl from "@/components/home-log/home-log.module.css";
import { ChildHeader } from "./ChildHeader";

// A child's page for an adult of her family: view only, or — with edit
// rights — reciting with her using the full form (word-by-word mistakes, and
// letter/gap tajweed with her switch), resolving her words, deleting sessions
// and changing her assessments. Her goal, streak and review reminders show
// with their switches.
export default async function AdultChildPage({ params }: PageProps<"/rafiq/family/[familyId]/child/[childId]">) {
  if (!familyEnabled()) redirect("/rafiq");
  const { familyId, childId } = await params;
  const found = await childForAdult(familyId, childId);
  if (!found) redirect(`/rafiq/family/${familyId}`);
  const { access, child, viewer } = found;
  const { data, commitment, tajweedSummary } = await childHomeData(child.id, child.flags);
  const base = `/rafiq/family/${access.family.id}/child/${child.id}`;
  return (
    <>
      <ChildHeader familyId={access.family.id} child={child} canEdit={viewer === "adult-edit"} on="page" you={access.user.gender} homeLog={child.flags.homeLog} />
      {data ? (
        <RafiqHome
          data={data}
          gender={access.user.gender}
          commitment={commitment}
          similar={child.flags.mutashabihat}
          tajweed={child.flags.tajweed}
          tajweedSummary={tajweedSummary}
          scope={{
            viewer,
            subjectId: child.id,
            child: { name: child.name, gender: child.gender },
            viewerId: access.user.id,
            adults: await familyAdults(access.family.id),
            streak: child.flags.streak,
            settingsHref: viewer === "adult-edit" ? `${base}/settings#commit` : undefined,
          }}
        />
      ) : (
        <div className={hl.section}>
          <div className={hl.empty}>لا توجد خطة حفظ بعد.</div>
        </div>
      )}
    </>
  );
}
