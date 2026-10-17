import { redirect } from "next/navigation";
import { familyEnabled } from "@/lib/family/enabled";
import { childForAdult, familyAdults } from "@/lib/family/child-pages";
import { getMemorization } from "@/lib/rafiq/memorization";
import { getCommitment } from "@/lib/rafiq/commitment";
import { RafiqHome } from "../../../../RafiqHome";
import hl from "@/components/home-log/home-log.module.css";
import { ChildHeader } from "./ChildHeader";

// A child's page for an adult of her family: view only, or — with edit
// rights — reciting with her using the full form (word-by-word mistakes),
// resolving her words, deleting sessions and changing her assessments.
export default async function AdultChildPage({ params }: PageProps<"/rafiq/family/[familyId]/child/[childId]">) {
  if (!familyEnabled()) redirect("/rafiq");
  const { familyId, childId } = await params;
  const found = await childForAdult(familyId, childId);
  if (!found) redirect(`/rafiq/family/${familyId}`);
  const { access, child, viewer } = found;
  const data = await getMemorization(child.id);
  return (
    <>
      <ChildHeader familyId={access.family.id} child={child} canEdit={viewer === "adult-edit"} on="page" you={access.user.gender} />
      {data ? (
        <RafiqHome
          data={data}
          gender={access.user.gender}
          commitment={await getCommitment(child.id)}
          scope={{ viewer, subjectId: child.id, child: { name: child.name, gender: child.gender }, viewerId: access.user.id, adults: await familyAdults(access.family.id) }}
        />
      ) : (
        <div className={hl.section}>
          <div className={hl.empty}>لا توجد خطة حفظ بعد.</div>
        </div>
      )}
    </>
  );
}
