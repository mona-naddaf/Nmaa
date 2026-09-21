// Small helper for gendering Arabic UI text along the app's two independent
// gender axes:
//  - GroupGender: a Group's own setting (Girls / Boys / Mixed), drives text
//    that describes or addresses that group's students.
//  - PersonGender: a Teacher's or Admin's own (optional) gender, drives text
//    addressed to or about that specific person (imperatives, role nouns).
//
// BOYS and MIXED both render as masculine — masculine-plural/singular is the
// grammatically standard neutral default in Arabic, so a mixed group and an
// all-boys group read identically.
//
// Callers compose these primitives into full sentences at the call site
// (e.g. `` `إضافة ${studentNoun(g)} ${newAdj(g)}` ``) rather than looking up
// whole pre-baked sentences — keeps this file small and keeps every string
// visible/greppable where it's actually used.
//
// Word pairs are always written out in full (never built by string-gluing a
// suffix onto a stem), because Arabic possessive/plural suffixes can change
// the stem's spelling (e.g. بطاقة + ها → بطاقتها, not بطاقةها).

export type GroupGender = "GIRLS" | "BOYS" | "MIXED";
export type PersonGender = "MALE" | "FEMALE" | null;

type Forms = { m: string; f: string };

/** Neutral default for course-wide/mixed-scope UI with no single group to bind to. */
export const NEUTRAL_GROUP_GENDER: GroupGender = "MIXED";

export function pickByGroup(gender: GroupGender, forms: Forms): string {
  return gender === "GIRLS" ? forms.f : forms.m;
}

export function pickByPerson(gender: PersonGender, forms: Forms): string {
  return gender === "FEMALE" ? forms.f : forms.m;
}

// ---- Common word pairs (group axis: about the student/group) ----

export const studentNoun = (g: GroupGender) => pickByGroup(g, { m: "طالب", f: "طالبة" });
export const studentNounDef = (g: GroupGender) => pickByGroup(g, { m: "الطالب", f: "الطالبة" });
export const studentsNoun = (g: GroupGender) => pickByGroup(g, { m: "طلاب", f: "طالبات" });
export const studentsNounDef = (g: GroupGender) => pickByGroup(g, { m: "الطلاب", f: "الطالبات" });
export const newAdj = (g: GroupGender) => pickByGroup(g, { m: "جديد", f: "جديدة" });
export const presentWord = (g: GroupGender) => pickByGroup(g, { m: "حاضر", f: "حاضرة" });
export const absentWord = (g: GroupGender) => pickByGroup(g, { m: "غائب", f: "غائبة" });
export const thisDemonstrative = (g: GroupGender) => pickByGroup(g, { m: "هذا", f: "هذه" });

// ---- Common word pairs (person axis: about/addressed to a teacher or admin) ----

export const teacherNoun = (p: PersonGender) => pickByPerson(p, { m: "معلم", f: "معلمة" });
export const teachersNoun = (p: PersonGender) => pickByPerson(p, { m: "معلمين", f: "معلمات" });
export const supervisorNoun = (p: PersonGender) => pickByPerson(p, { m: "مشرف", f: "مشرفة" });

/** For one-off verb conjugations addressed directly to the viewer (اضغط/اضغطي, اختر/اختاري, ...). */
export const imperative = (p: PersonGender, forms: Forms) => pickByPerson(p, forms);
