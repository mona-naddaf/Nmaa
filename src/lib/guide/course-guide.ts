import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth/session";
import type { StudentAccess } from "@/lib/auth/student-session";
import { canAddPrior, canAddStudents, canArchiveStudents, canEditPlan, canEditStudents, canUseOfflineSheet } from "@/lib/students/manage";
import { studentCodeAccess } from "@/lib/students/student-codes";
import { courseExcuseAllowed, groupSees, staffViewer } from "@/lib/excuse/course-data";
import { staffSetsItemExcuse } from "@/lib/excuse/visibility";
import { guidePreviewAllowed } from "@/lib/guide/enabled";
import { DEFAULT_GROUP_NAMES } from "@/lib/points/defaults";
import { supervisorNoun } from "@/lib/text/gender";
import { courseGuideAllowed, courseGuideListed, isNewSince } from "./course-enabled";
import { courseGuideCookie, readCourseGuide, type CourseGuideKey } from "./course-keys";
import { COURSE_CHECKLIST, COURSE_PRESS_HELP, type CourseChecklistId } from "./course-texts";
import { COURSE_PRESS_LABELS, EXCUSE_CARD_LABEL } from "./help/course/server-texts";
import { STAFF_HELP } from "./help/course/staff";
import { STUDENT_HELP } from "./help/course/student";
import { PARENT_HELP } from "./help/course/parent";
import { courseExcuseHelp, type CourseExcuseViewer } from "./help/course/excuse";
import { fillCourse, staffHelpPage, viewerHelpPage, type CourseFill } from "./help/course/build";
import type { CourseFeatures, CourseHelpPage, CoursePageId, CourseRawPage, ParentFacts, StaffFacts, StudentFacts } from "./help/course/types";
import type { CourseHost } from "./help/course/pages";

// The courses' guide for one viewer, built on the server (COURSE_GUIDE_EMAILS,
// by the course supervisor's email): her help pages, the welcome lines still
// to show, the line announcing «؟» and, for the supervisor of a new course,
// «الخطوات الأولى». Nothing is read while the list is empty, and nothing that
// isn't hers leaves the server. Her dismissals live in a cookie (course-keys.ts).

type Pages = Partial<Record<CoursePageId, CourseHelpPage>>;

export type CourseChecklistItem = { id: CourseChecklistId; title: string; note: string; done: boolean; tour: { page: CoursePageId; question: string } };

export type CourseGuideProps = {
  host: CourseHost;
  gender: "MALE" | "FEMALE";
  pages: Pages;
  titles: Partial<Record<CoursePageId, string>>;
  preview: boolean;
  cookie: string;
  marks: CourseGuideKey[];
  // new users: each page's line until «فهمت» (filled; [f|m] left for the client)
  welcome: Partial<Record<CoursePageId, string>>;
  // existing users: the one line announcing «؟», until «×»
  announce: boolean;
  // the supervisor of a new course, until hidden or celebrated
  checklist: CourseChecklistItem[] | null;
  // the buttons a tour waits on, named as the page shows them
  labels: Record<string, string | { plain: string }>;
};

// the excuse card's name only for a viewer whose help has its question
const labelsFor = (fill: CourseFill, excuse = false) =>
  Object.fromEntries(
    Object.entries<string | { plain: string }>({ ...COURSE_PRESS_LABELS, ...(excuse ? EXCUSE_CARD_LABEL : {}) }).map(([k, v]) => [k, typeof v === "string" ? fillCourse(v, fill) : { plain: fillCourse(v.plain, fill) }]),
  );

const FEATURES_SELECT = {
  studentLoginEnabled: true,
  studentBoardEnabled: true,
  homeLogEnabled: true,
  homeMistakesEnabled: true,
  assignmentsEnabled: true,
  trackerEnabled: true,
  trackerAgendaEnabled: true,
  trackerSummaryEnabled: true,
  calendarEnabled: true,
  onlineRecitationEnabled: true,
  boardCode: true,
  studentInfoEnabled: true,
  parentStudentInfoEdit: true,
  streakMode: true,
  reviewReminderDays: true,
  tajweedDetailEnabled: true,
  mutashabihatTeachersEnabled: true,
  mutashabihatStudentsEnabled: true,
} as const;

type FeatureRow = {
  studentLoginEnabled: boolean;
  studentBoardEnabled: boolean;
  homeLogEnabled: boolean;
  homeMistakesEnabled: boolean;
  assignmentsEnabled: boolean;
  trackerEnabled: boolean;
  trackerAgendaEnabled: boolean;
  trackerSummaryEnabled: boolean;
  calendarEnabled: boolean;
  onlineRecitationEnabled: boolean;
  boardCode: string | null;
  studentInfoEnabled: boolean;
  parentStudentInfoEdit: boolean;
  streakMode: string | null;
  reviewReminderDays: number | null;
  tajweedDetailEnabled: boolean;
  mutashabihatTeachersEnabled: boolean;
  mutashabihatStudentsEnabled: boolean;
};

/** The course's switches as the help needs them (each only with what it lives in). */
export function courseFeatures(c: FeatureRow): CourseFeatures {
  const login = c.studentLoginEnabled;
  const tracker = login && c.trackerEnabled;
  return {
    studentLogin: login,
    studentBoard: login && c.studentBoardEnabled,
    homeLog: login && c.homeLogEnabled,
    homeMistakes: login && c.homeLogEnabled && c.homeMistakesEnabled,
    assignments: login && c.assignmentsEnabled,
    tracker,
    agenda: tracker && c.trackerAgendaEnabled,
    summary: tracker && c.trackerSummaryEnabled,
    calendar: c.calendarEnabled,
    online: c.onlineRecitationEnabled,
    board: c.boardCode !== null,
    studentInfo: c.studentInfoEnabled,
    parentInfoEdit: c.studentInfoEnabled && c.parentStudentInfoEdit,
    streak: c.streakMode !== null,
    review: c.reviewReminderDays !== null,
    tajweed: c.tajweedDetailEnabled,
    similarStaff: c.mutashabihatTeachersEnabled,
    similarStudents: login && c.homeLogEnabled && c.mutashabihatStudentsEnabled,
  };
}

/** Each page's help, plus the excuse questions (always after its own, under «أسئلة أخرى»). */
function withExcuse(pages: Pages, extra: Partial<Record<CoursePageId, CourseHelpPage["questions"]>>): Pages {
  const out = { ...pages };
  for (const [id, qs] of Object.entries(extra) as [CoursePageId, CourseHelpPage["questions"]][]) {
    const p = out[id];
    if (p && qs.length) out[id] = { ...p, questions: [...p.questions, ...qs] };
  }
  return out;
}

async function marksFor(cookie: string): Promise<Set<CourseGuideKey>> {
  return readCourseGuide((await cookies()).get(cookie)?.value);
}

function welcomeFor<F>(raw: CourseRawPage<F>[], isNew: boolean, marks: Set<CourseGuideKey>, fill: CourseFill): Partial<Record<CoursePageId, string>> {
  const out: Partial<Record<CoursePageId, string>> = {};
  if (!isNew) return out;
  for (const p of raw) if (p.welcome && !marks.has(`w.${p.id}`)) out[p.id] = `${fillCourse(p.welcome, fill)} ${COURSE_PRESS_HELP}`;
  return out;
}

const titlesOf = (pages: Pages) => Object.fromEntries(Object.entries(pages).map(([id, p]) => [id, p!.title])) as Partial<Record<CoursePageId, string>>;

/** A choice in «الإعدادات» that isn't the new course's default (the checklist's last step). */
function settingsChosen(c: FeatureRow & Record<string, unknown>): boolean {
  const perms = ["addStudentsPermission", "editStudentsPermission", "archiveStudentsPermission", "addPriorPermission", "offlineSheetPermission", "editPlanPermission", "issueStudentCodesPermission", "calendarEditPermission"];
  return (
    perms.some((p) => c[p] === "ALL_TEACHERS") ||
    c.visibilityMode === "ASSIGNED" ||
    c.studentLoginEnabled ||
    c.calendarEnabled ||
    c.reviewReminderDays !== null ||
    c.streakMode !== null ||
    c.boardCode !== null ||
    c.studentInfoEnabled ||
    c.tajweedDetailEnabled ||
    c.mutashabihatTeachersEnabled ||
    c.excuseEnabled === true ||
    c.onlineRecitationEnabled === false ||
    !!c.showSurahProgress ||
    !!c.showJuzProgress ||
    !!c.showQuranProgress ||
    !!c.showPlanProgress
  );
}

/** The supervisor's and the teachers' guide, or null when the course isn't in COURSE_GUIDE_EMAILS. */
export async function staffGuideProps(session: Session): Promise<CourseGuideProps | null> {
  if (!courseGuideListed()) return null;
  const course = await prisma.course.findUnique({
    where: { id: session.courseId },
    select: {
      ...FEATURES_SELECT,
      id: true,
      createdAt: true,
      excuseEnabled: true,
      visibilityMode: true,
      addStudentsPermission: true,
      editStudentsPermission: true,
      archiveStudentsPermission: true,
      addPriorPermission: true,
      offlineSheetPermission: true,
      editPlanPermission: true,
      issueStudentCodesPermission: true,
      calendarEditPermission: true,
      showSurahProgress: true,
      showJuzProgress: true,
      showQuranProgress: true,
      showPlanProgress: true,
      admin: { select: { email: true, gender: true } },
      groups: { select: { id: true, name: true, gender: true } },
    },
  });
  if (!course || !courseGuideAllowed(course.admin.email)) return null;

  const isAdmin = session.role === "admin";
  const me = isAdmin ? null : await prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true, createdAt: true, groupAssignments: { select: { groupId: true } } } });
  const gender = (isAdmin ? course.admin.gender : me?.gender) ?? null;
  const cookie = courseGuideCookie({ kind: isAdmin ? "admin" : "teacher", id: isAdmin ? session.adminId : session.teacherId });
  const [marks, students, archived, teachers, codes] = await Promise.all([
    marksFor(cookie),
    prisma.student.count({ where: { courseId: course.id, archivedAt: null } }),
    prisma.student.count({ where: { courseId: course.id, archivedAt: { not: null } } }),
    prisma.teacher.count({ where: { courseId: course.id, isSupervisorProxy: false } }),
    studentCodeAccess(session),
  ]);

  const features = courseFeatures(course);
  const facts: StaffFacts = {
    role: isAdmin ? "admin" : "teacher",
    perms: {
      add: canAddStudents(session, course),
      edit: canEditStudents(session, course),
      archive: canArchiveStudents(session, course),
      prior: canAddPrior(session, course),
      offline: canUseOfflineSheet(session, course),
      plan: canEditPlan(session, course),
      codes: codes.allowed,
      calendarManage: isAdmin || course.calendarEditPermission === "ALL_TEACHERS",
    },
    features,
    students,
    archived,
    groups: course.groups.length,
    ownGroups: me?.groupAssignments.length ?? 0,
  };
  const fill: CourseFill = {
    students: course.groups.length > 0 && course.groups.every((g) => g.gender === "GIRLS") ? "f" : "m",
    sup: `${supervisorNoun(course.admin.gender ?? "FEMALE")} الدورة`,
    supOnly: `ال${supervisorNoun(course.admin.gender)} فقط`,
  };

  // «أيام العذر»: decided here with the feature's own rules, before any of it is added
  const viewer = await staffViewer(session);
  const excuse: CourseExcuseViewer = {
    kind: "staff",
    admin: isAdmin,
    gender,
    allowed: await courseExcuseAllowed(course.id),
    on: course.excuseEnabled,
    girlsGroups: course.groups.some((g) => g.gender === "GIRLS"),
    sees: course.groups.some((g) => g.gender === "GIRLS" && groupSees(viewer, g.id, g.gender)),
    itemField: staffSetsItemExcuse(gender),
    tracker: features.tracker,
  };
  const excuseHelp = courseExcuseHelp(excuse);
  const pages = withExcuse(Object.fromEntries(STAFF_HELP.map((raw) => [raw.id, staffHelpPage(raw, facts, fill)])), excuseHelp);

  const isNew = isNewSince(isAdmin ? course.createdAt : me?.createdAt);
  let checklist: CourseChecklistItem[] | null = null;
  if (isAdmin && isNewSince(course.createdAt) && !marks.has("cl.hidden") && !marks.has("cl.done")) {
    const defaultGroups =
      course.groups.length === 1 && course.groups[0].name === DEFAULT_GROUP_NAMES[0] && course.groups[0].gender === "GIRLS";
    const done: Record<CourseChecklistId, boolean> = {
      groups: !defaultGroups,
      students: students + archived > 0,
      teachers: teachers > 0,
      settings: settingsChosen(course),
    };
    const tours: Record<CourseChecklistId, { page: CoursePageId; id: string }> = {
      groups: { page: "s.settings", id: "S14.3" },
      students: { page: "s.students", id: "S1.3" },
      teachers: { page: "s.settings", id: "S14.1" },
      settings: { page: "s.settings", id: "S14.2" },
    };
    checklist = (Object.keys(done) as CourseChecklistId[]).map((id) => {
      const raw = STAFF_HELP.find((p) => p.id === tours[id].page)!.questions.find((q) => q.id === tours[id].id)!;
      return {
        id,
        title: fillCourse(COURSE_CHECKLIST.items[id].title, fill),
        note: fillCourse(COURSE_CHECKLIST.items[id].note, fill),
        done: done[id],
        tour: { page: tours[id].page, question: fillCourse(raw.q, fill) },
      };
    });
  }

  return {
    host: "staff",
    gender: gender ?? "FEMALE",
    pages,
    titles: titlesOf(pages),
    preview: guidePreviewAllowed(course.admin.email),
    cookie,
    marks: [...marks],
    welcome: welcomeFor(STAFF_HELP, isNew, marks, fill),
    announce: !isNew && !marks.has("ann"),
    checklist,
    labels: labelsFor(fill, !!excuseHelp["s.settings"]),
  };
}

/** A student's own guide (/student), or null. */
export async function studentGuideProps(access: StudentAccess): Promise<CourseGuideProps | null> {
  if (!courseGuideListed()) return null;
  const s = await prisma.student.findUnique({
    where: { id: access.studentId },
    select: {
      studentCodeCreatedAt: true,
      tajweedDetailed: true,
      group: { select: { gender: true } },
      course: { select: { id: true, excuseEnabled: true, ...FEATURES_SELECT, admin: { select: { email: true } } } },
    },
  });
  if (!s || !courseGuideAllowed(s.course.admin.email)) return null;
  const girl = s.group.gender === "GIRLS";
  const cookie = courseGuideCookie({ kind: "student", id: access.studentId });
  const marks = await marksFor(cookie);
  const facts: StudentFacts = { features: courseFeatures(s.course), tajweedHers: access.tajweedDetail };
  // her own words: [f|m] by her group; <f|m> isn't used on her pages
  const fill: CourseFill = { students: girl ? "f" : "m" };
  const shown = STUDENT_HELP.filter((raw) => studentPageShown(raw.id, facts.features));
  const pages = withExcuse(
    Object.fromEntries(shown.map((raw) => [raw.id, viewerHelpPage(raw, facts, fill)])),
    courseExcuseHelp({ kind: "student", girl, allowed: await courseExcuseAllowed(s.course.id), on: s.course.excuseEnabled, tracker: facts.features.tracker }),
  );
  const isNew = isNewSince(s.studentCodeCreatedAt);
  return {
    host: "student",
    gender: girl ? "FEMALE" : "MALE",
    pages,
    titles: titlesOf(pages),
    preview: guidePreviewAllowed(s.course.admin.email),
    cookie,
    marks: [...marks],
    welcome: welcomeFor(shown, isNew, marks, fill),
    announce: !isNew && !marks.has("ann"),
    checklist: null,
    labels: labelsFor(fill),
  };
}

/** The student's pages that exist with the course's switches (a tab per feature). */
function studentPageShown(page: CoursePageId, f: CourseFeatures): boolean {
  switch (page) {
    case "st.homelog":
    case "st.segment":
      return f.homeLog;
    case "st.assignments":
      return f.assignments;
    case "st.tracker":
      return f.tracker;
    case "st.summary":
      return f.summary;
    case "st.board":
      return f.studentBoard;
    default:
      return true;
  }
}

/** A parent's guide (/parent), or null. Both parents share the code, so the words are neutral or masculine. */
export async function parentGuideProps(studentId: string): Promise<CourseGuideProps | null> {
  if (!courseGuideListed()) return null;
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      parentCodeCreatedAt: true,
      tajweedDetailed: true,
      excuseParentVisible: true,
      group: { select: { gender: true } },
      course: { select: { id: true, excuseEnabled: true, ...FEATURES_SELECT, admin: { select: { email: true } } } },
    },
  });
  if (!s || !courseGuideAllowed(s.course.admin.email)) return null;
  const girl = s.group.gender === "GIRLS";
  const cookie = courseGuideCookie({ kind: "parent", id: studentId });
  const marks = await marksFor(cookie);
  const features = courseFeatures(s.course);
  const facts: ParentFacts = { features, tajweedHers: s.course.tajweedDetailEnabled && s.tajweedDetailed, infoFields: features.parentInfoEdit };
  const fill: CourseFill = { students: girl ? "f" : "m" };
  const pages = withExcuse(
    Object.fromEntries(PARENT_HELP.map((raw) => [raw.id, viewerHelpPage(raw, facts, fill)])),
    courseExcuseHelp({ kind: "parent", girl, allowed: await courseExcuseAllowed(s.course.id), on: s.course.excuseEnabled, parentVisible: s.excuseParentVisible }),
  );
  const isNew = isNewSince(s.parentCodeCreatedAt);
  return {
    host: "parent",
    gender: "MALE",
    pages,
    titles: titlesOf(pages),
    preview: guidePreviewAllowed(s.course.admin.email),
    cookie,
    marks: [...marks],
    welcome: welcomeFor(PARENT_HELP, isNew, marks, fill),
    announce: !isNew && !marks.has("ann"),
    checklist: null,
    labels: labelsFor(fill),
  };
}
