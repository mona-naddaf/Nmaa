import { parseAllowList } from "@/lib/excuse/enabled";
import { guideEnabled } from "@/lib/guide/enabled";
import { familyEnabled } from "./enabled";

// The guide on «العائلة»'s pages (the child's start questions, «؟» for the
// child and for the adults, the join card, the family excuse guide), while
// it's tried out: FAMILY_GUIDE_EMAILS lists the founders whose families have
// it (emails, or «*» for everyone; unset or empty: nobody). Always the
// family founder's email decides, for the child, for the adults on her pages
// and for the family's own pages. On top of the guidance and «العائلة»
// themselves. No DB and no server-only imports.
export function familyGuideAllowed(founderEmail: string | null | undefined): boolean {
  if (!guideEnabled() || !familyEnabled()) return false;
  const list = parseAllowList(process.env.FAMILY_GUIDE_EMAILS);
  if (!list) return false;
  if (list.has("*")) return true;
  return !!founderEmail && list.has(founderEmail.trim().toLowerCase());
}

/** Whether any family could have it here: false skips every query for it. */
export function familyGuideListed(): boolean {
  return guideEnabled() && familyEnabled() && (parseAllowList(process.env.FAMILY_GUIDE_EMAILS)?.size ?? 0) > 0;
}
