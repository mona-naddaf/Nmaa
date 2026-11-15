import { familyEnabled } from "@/lib/family/enabled";
import { familyGuideListed } from "@/lib/family/guide-enabled";
import { childForAdult } from "@/lib/family/child-pages";
import { adultChildGuideProps } from "@/lib/family/guide-pages";
import { AdultChildGuideShell } from "@/components/guide/family/FamilyGuideShells";

// One child's pages, as an adult of her family sees them. Only «العائلة»'s
// guide (FAMILY_GUIDE_EMAILS) is added here, where it reaches the family; the
// pages themselves check access as before.
export default async function AdultChildLayout({ children, params }: LayoutProps<"/rafiq/family/[familyId]/child/[childId]">) {
  if (!familyEnabled() || !familyGuideListed()) return children;
  const { familyId, childId } = await params;
  const found = await childForAdult(familyId, childId);
  if (!found) return children;
  const guide = await adultChildGuideProps({ id: found.access.user.id, gender: found.access.user.gender }, found.access.family.id, found.child, found.viewer === "adult-edit");
  return guide ? <AdultChildGuideShell guide={guide.props}>{children}</AdultChildGuideShell> : children;
}
