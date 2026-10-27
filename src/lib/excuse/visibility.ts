// «أيام العذر»: who may see a girl's excuse, and who may start or end it.
// Pure; the server decides with these before anything about an excuse is
// loaded, so a viewer who may not see it never receives it. Such a viewer
// sees no text at all: the items it skips are simply not counted that day
// and an alternative looks like the item (Mona, 2026-10-27).

type G = "MALE" | "FEMALE" | null;

// ---------- courses: girls groups only ----------

export type CourseViewer =
  | { kind: "SUPERVISOR"; gender: G }
  // groupIds: the groups she is assigned to (TeacherGroupAssignment) — not
  // whatever the course's visibility lets her see
  | { kind: "TEACHER"; gender: G; groupIds: string[] }
  | { kind: "STUDENT"; studentId: string }
  | { kind: "PARENT"; studentId: string };

export interface CourseStudent {
  id: string;
  groupId: string;
  groupGender: "GIRLS" | "BOYS" | "MIXED";
  // «إظهار العذر لوليّ الأمر»
  parentVisible: boolean;
}

/** The feature reaches her at all: on in the course, and her group is a girls group. */
export const courseExcuseApplies = (enabled: boolean, groupGender: CourseStudent["groupGender"]) => enabled && groupGender === "GIRLS";

/**
 * Sees «معذورة»: she herself; the supervisor and the teachers of her group,
 * unless recorded as male (no gender recorded = sees); her parents only
 * with «إظهار العذر لوليّ الأمر».
 */
export function courseSees(viewer: CourseViewer, s: CourseStudent, enabled: boolean): boolean {
  if (!courseExcuseApplies(enabled, s.groupGender)) return false;
  switch (viewer.kind) {
    case "STUDENT":
      return viewer.studentId === s.id;
    case "PARENT":
      return viewer.studentId === s.id && s.parentVisible;
    case "SUPERVISOR":
      return viewer.gender !== "MALE";
    case "TEACHER":
      return viewer.gender !== "MALE" && viewer.groupIds.includes(s.groupId);
  }
}

/** Starts and ends it (and records «معذورة» in attendance, staff only): whoever sees it, except a parent. */
export const courseActs = (viewer: CourseViewer, s: CourseStudent, enabled: boolean) => viewer.kind !== "PARENT" && courseSees(viewer, s, enabled);

/** The «في أيام العذر» field of an item (her own items: she; staff's: their owner, as for the rest of the item) — never for staff recorded as male. */
export const staffSetsItemExcuse = (gender: G) => gender !== "MALE";

// ---------- «رفيق الحفظ» and the family ----------

/** An adult's own excuse: hers alone, never shown to anyone else (sharing or not). */
export const adultExcuseApplies = (u: { kind: "ADULT" | "CHILD"; gender: "MALE" | "FEMALE"; excuseEnabled: boolean }) =>
  u.kind === "ADULT" && u.gender === "FEMALE" && u.excuseEnabled;

/** The family's default for an adult who hasn't been set either way: women see, men don't. */
export const familyDefaultSees = (adultGender: "MALE" | "FEMALE") => adultGender === "FEMALE";

export type FamilyViewer = { kind: "CHILD"; id: string } | { kind: "ADULT"; id: string; gender: "MALE" | "FEMALE" };

/**
 * A girl child's excuse («أيام العذر» on): she herself, and the adults
 * checked in her list (no row: the default by gender). Siblings never.
 * overrides: adultId → checked, from her list's rows.
 */
export function familySees(
  viewer: FamilyViewer,
  child: { id: string; gender: "MALE" | "FEMALE"; excuseEnabled: boolean },
  overrides: Map<string, boolean>,
): boolean {
  if (child.gender !== "FEMALE" || !child.excuseEnabled) return false;
  if (viewer.kind === "CHILD") return viewer.id === child.id;
  return overrides.get(viewer.id) ?? familyDefaultSees(viewer.gender);
}

/** Starts and ends it: the same people who see it (decision 6). */
export const familyActs = familySees;
