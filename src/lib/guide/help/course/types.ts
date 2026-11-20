import type { GuideTarget } from "../targets";
import type { HelpPage, HelpQuestion } from "../types";

// The courses' help pages and the raw questions their content files hold: a
// help question, plus what it needs (a teacher's permission, a course
// feature) and who it is for. build.ts turns them into plain help for one
// viewer, on the server: nothing here reaches a browser unless it is hers.

export type CoursePageId =
  // the supervisor and the teachers (the dashboard)
  | "s.students"
  | "s.student"
  | "s.new"
  | "s.import"
  | "s.archive"
  | "s.offline"
  | "s.parentCodes"
  | "s.studentCodes"
  | "s.leaderboard"
  | "s.assignments"
  | "s.tracker"
  | "s.reports"
  | "s.calendar"
  | "s.resources"
  | "s.settings"
  // a student (/student)
  | "st.home"
  | "st.homelog"
  | "st.segment"
  | "st.assignments"
  | "st.tracker"
  | "st.summary"
  | "st.board"
  // a parent (/parent)
  | "p.home";

/** A teacher's permissions (the supervisor has them all). */
export type StaffPerm = "add" | "edit" | "archive" | "prior" | "offline" | "plan" | "codes" | "calendarManage";

/** The course's switches, as the help needs them. */
export type CourseFeature =
  | "studentLogin"
  | "studentBoard"
  | "homeLog"
  | "homeMistakes"
  | "assignments"
  | "tracker"
  | "agenda"
  | "summary"
  | "calendar"
  | "online"
  | "board"
  | "studentInfo"
  | "parentInfoEdit"
  | "streak"
  | "review"
  | "tajweed"
  | "similarStaff"
  | "similarStudents";

export type CourseFeatures = Record<CourseFeature, boolean>;

/** What the viewer is and has, decided on the server. */
export type StaffFacts = {
  role: "admin" | "teacher";
  perms: Record<StaffPerm, boolean>;
  features: CourseFeatures;
  // students in her view of the course (archived ones aside), and groups
  students: number;
  archived: number;
  groups: number;
  // a teacher: groups assigned to her
  ownGroups: number;
};

export type StudentFacts = { features: CourseFeatures; tajweedHers: boolean };

export type ParentFacts = { features: CourseFeatures; tajweedHers: boolean; infoFields: boolean };

export type CourseQuestion<F = StaffFacts> = HelpQuestion<GuideTarget, CoursePageId> & {
  // a stable id (the review page's)
  id: string;
  // supervisor only: hidden for a teacher (nothing a permission could give her)
  adminOnly?: true;
  // a teacher needs this permission: without it the question stays, under «أسئلة أخرى», with the line that the supervisor can grant it
  perm?: StaffPerm;
  // the course features it needs (all on): off, the supervisor gets «تفعيل الآن» to its card, the others a line
  feat?: CourseFeature | CourseFeature[];
  // with a feature off, hidden for anyone who can't turn it on (it would only confuse)
  hideOff?: true;
  // listed only when this holds
  show?: (facts: F) => boolean;
};

export type CourseRawPage<F = StaffFacts> = { id: CoursePageId; title: string; welcome?: string; questions: CourseQuestion<F>[] };

export type CourseHelpPage = HelpPage<GuideTarget, CoursePageId>;
