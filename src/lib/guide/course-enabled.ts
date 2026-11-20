import { parseAllowList } from "@/lib/excuse/enabled";

// The guide on the courses' pages («؟ كيف أستخدم هذه الصفحة», the welcome
// lines, the supervisor's «الخطوات الأولى») and, until they are opened to
// everyone, the courses' clarity fixes, while they are tried out:
// COURSE_GUIDE_EMAILS lists the course supervisors whose courses have them
// (emails, or «*» for every course; unset or empty: nobody). Always the
// course supervisor's email decides, for her teachers, her students and their
// parents too. Independent of «رفيق الحفظ» and its ONBOARDING_ENABLED. No DB
// and no server-only imports.

export function courseGuideAllowed(supervisorEmail: string | null | undefined): boolean {
  const list = parseAllowList(process.env.COURSE_GUIDE_EMAILS);
  if (!list) return false;
  if (list.has("*")) return true;
  return !!supervisorEmail && list.has(supervisorEmail.trim().toLowerCase());
}

/** Whether any course could have it here: false skips every query for it. */
export const courseGuideListed = (): boolean => (parseAllowList(process.env.COURSE_GUIDE_EMAILS)?.size ?? 0) > 0;

/**
 * Who counts as new (the welcome lines; the checklist for a new course):
 * created (or, for a student or a parent, given a code) on or after this
 * moment. Everyone before it is an existing user and gets only the «؟»
 * button and the one line that announces it. COURSE_GUIDE_SINCE (an ISO date)
 * moves it, e.g. to the day the guide opens to everyone.
 */
export const COURSE_GUIDE_SINCE_DEFAULT = "2026-11-20T00:00:00Z";

export function courseGuideSince(): Date {
  const raw = process.env.COURSE_GUIDE_SINCE;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : new Date(COURSE_GUIDE_SINCE_DEFAULT);
}

export const isNewSince = (at: Date | null | undefined, since: Date = courseGuideSince()): boolean => !!at && at.getTime() >= since.getTime();
