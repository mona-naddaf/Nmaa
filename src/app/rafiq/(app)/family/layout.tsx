import { getRafiqUser } from "@/lib/rafiq/session";
import { familyEnabled } from "@/lib/family/enabled";
import { familyGuideListed } from "@/lib/family/guide-enabled";
import { familyPagesGuideProps } from "@/lib/family/guide-pages";
import { FamilyPagesGuideShell } from "@/components/guide/family/FamilyGuideShells";

// «عائلتي» and everything under it. Only «العائلة»'s guide (FAMILY_GUIDE_EMAILS)
// is added here, where it reaches one of her families (or her): the pages are
// exactly as before for everyone else, and nothing is read for it while the
// list is empty.
export default async function FamilyAreaLayout({ children }: LayoutProps<"/rafiq/family">) {
  if (!familyEnabled() || !familyGuideListed()) return children;
  const user = await getRafiqUser();
  const guide = user ? await familyPagesGuideProps(user.email) : null;
  return guide ? <FamilyPagesGuideShell guide={guide}>{children}</FamilyPagesGuideShell> : children;
}
