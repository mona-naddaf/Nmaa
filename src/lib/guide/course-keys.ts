// What a course user has dismissed in the guide, kept in a cookie on her
// device (no database change): «فهمت» on a page's welcome line, «×» on the line
// announcing «؟», and the supervisor's checklist hidden or celebrated. One
// cookie per person and role, so a teacher and a parent on one shared device
// keep their own. Unknown keys are dropped when read. Pure.

import type { CoursePageId } from "./help/course/types";

export type CourseGuideKey = `w.${CoursePageId}` | "ann" | "cl.hidden" | "cl.done";

const PAGE = /^(s\.(students|student|new|import|archive|offline|parentCodes|studentCodes|leaderboard|assignments|tracker|reports|calendar|resources|settings)|st\.(home|homelog|segment|assignments|tracker|summary|board)|p\.home)$/;

export const isCourseGuideKey = (raw: string): raw is CourseGuideKey =>
  raw === "ann" || raw === "cl.hidden" || raw === "cl.done" || (raw.startsWith("w.") && PAGE.test(raw.slice(2)));

export type CourseGuideWho = { kind: "admin" | "teacher" | "student" | "parent"; id: string };

/** The cookie's name for one person in one role (ids are cuids: letters and digits). */
export function courseGuideCookie(who: CourseGuideWho): string {
  const id = who.id.replace(/[^A-Za-z0-9]/g, "");
  return `cg_${who.kind[0]}_${id}`;
}

const SEP = "|";

/** The cookie's value → the keys it holds (the code's own only). */
export function readCourseGuide(raw: string | undefined | null): Set<CourseGuideKey> {
  const out = new Set<CourseGuideKey>();
  if (!raw) return out;
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    // a value that isn't encoded: read as it is
  }
  for (const k of text.split(SEP)) if (isCourseGuideKey(k)) out.add(k);
  return out;
}

export const writeCourseGuide = (keys: Iterable<CourseGuideKey>): string => encodeURIComponent([...new Set(keys)].filter(isCourseGuideKey).sort().join(SEP));

/** About five years: a dismissal stays. */
export const COURSE_GUIDE_COOKIE_DAYS = 1825;
