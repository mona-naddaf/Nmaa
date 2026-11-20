import type { CoursePageId } from "./types";

// Where the courses' help pages are, for each of their three hosts. Pure.

export type CourseHost = "staff" | "student" | "parent";

const trim = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);

const STAFF: Record<string, CoursePageId> = {
  "/students": "s.students",
  "/students/new": "s.new",
  "/students/import": "s.import",
  "/students/archive": "s.archive",
  "/students/offline": "s.offline",
  "/students/parent-codes": "s.parentCodes",
  "/students/student-codes": "s.studentCodes",
  "/leaderboard": "s.leaderboard",
  "/assignments": "s.assignments",
  "/tracker": "s.tracker",
  "/reports": "s.reports",
  "/calendar": "s.calendar",
  "/resources": "s.resources",
  "/settings": "s.settings",
};

const STUDENT: Record<string, CoursePageId> = {
  "/student": "st.home",
  "/student/home-log": "st.homelog",
  "/student/assignments": "st.assignments",
  "/student/tracker": "st.tracker",
  "/student/tracker/summary": "st.summary",
  "/student/board": "st.board",
};

export function coursePageFor(host: CourseHost, pathname: string): CoursePageId | null {
  const path = trim(pathname);
  if (host === "parent") return path === "/parent" ? "p.home" : null;
  if (host === "student") return STUDENT[path] ?? (/^\/student\/home-log\/[^/]+$/.test(path) ? "st.segment" : null);
  // a student's own page: any id but the fixed pages above (and not the archive's)
  return STAFF[path] ?? (/^\/students\/[^/]+$/.test(path) ? "s.student" : null);
}

const HREF: Partial<Record<CoursePageId, string>> = {
  ...Object.fromEntries(Object.entries(STAFF).map(([href, page]) => [page, href])),
  ...Object.fromEntries(Object.entries(STUDENT).map(([href, page]) => [page, href])),
  "p.home": "/parent",
};

/** A page's address (null: no fixed one, like one student's page or one segment). */
export const courseHrefOf = (page: CoursePageId): string | null => HREF[page] ?? null;
