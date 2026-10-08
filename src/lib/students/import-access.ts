import "server-only";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth/session";
import type { GroupGender, PersonGender } from "@/lib/text/gender";
import { canAddStudents, teacherGroupLimit } from "./manage";
import { editorFor, staffInfoAccess, visibleInfoFields } from "./extra-info";
import type { InfoField } from "./extra-info-rules";

// Who may use the Excel import, and with what: the import page, the
// template download and the upload action all go through here, so a
// teacher's template and her upload follow the same rules as her manual add
// form — the add-students permission, only her groups (teacherGroupLimit),
// and only the extra-info fields that form shows her.

export interface ImportAccess {
  courseId: string;
  // the groups she may import into, in display order
  groups: { id: string; name: string; gender: GroupGender }[];
  /** null = every group in the course */
  groupLimit: string[] | null;
  studentInfoEnabled: boolean;
  // the enabled fields she may fill (none with the feature off), in display order
  infoFields: InfoField[];
  updatedBy: ReturnType<typeof editorFor>;
  viewerGender: PersonGender;
}

/** null when she may not import at all. */
export async function getImportAccess(session: Session): Promise<ImportAccess | null> {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    select: {
      addStudentsPermission: true,
      editStudentsPermission: true,
      studentInfoEnabled: true,
      visibilityMode: true,
      groups: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, gender: true } },
    },
  });
  if (!canAddStudents(session, course)) return null;

  const groupLimit = await teacherGroupLimit(session, course);
  // same as the add form: a teacher without the edit-students permission
  // adds students without extra info
  const infoAccess = staffInfoAccess(session, course);
  const [infoFields, viewer] = await Promise.all([
    infoAccess.edit ? visibleInfoFields(session.courseId, infoAccess) : Promise.resolve([]),
    session.role === "admin"
      ? prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } })
      : prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true } }),
  ]);

  return {
    courseId: session.courseId,
    groups: groupLimit ? course.groups.filter((g) => groupLimit.includes(g.id)) : course.groups,
    groupLimit,
    studentInfoEnabled: course.studentInfoEnabled,
    infoFields,
    updatedBy: editorFor(infoAccess.viewer),
    viewerGender: viewer?.gender ?? null,
  };
}
