import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { deriveCurrentPosition, deriveReach } from "@/lib/recitation/logic";
import { getActiveMistakes } from "@/lib/students/mistakes";
import { computeStreaks } from "@/lib/students/streak-data";
import { attendanceStatusForDay, todayDateOnly } from "@/lib/attendance";
import { TOTAL_PAGES } from "@/lib/quran-data";
import { buildCoverage, computeProgressBars, coverageToRanges, coveredQuranPages } from "@/lib/students/progress";
import { computeOverdueSurahs } from "@/lib/students/review";
import { DetailView } from "./DetailView";
import { ParentCodeCard } from "./ParentCodeCard";
import { StudentCodeCard } from "./StudentCodeCard";
import { StaffHomeLog } from "./StaffHomeLog";
import { effectiveTargets, getHomeLog } from "@/lib/home-log/data";
import { inScope, studentCodeAccess } from "@/lib/students/student-codes";
import { StudentManageBar } from "./StudentManageBar";
import { requestOrigin } from "@/lib/request-origin";
import styles from "./manage.module.css";
import { canArchiveStudents, canEditStudents, teacherGroupLimit } from "@/lib/students/manage";
import { pickByGroup, studentNounDef } from "@/lib/text/gender";
import { getStudentAssignments } from "@/lib/assignments/data";
import { StaffStudentAssignments } from "./StaffStudentAssignments";
import { getStudentTracker } from "@/lib/tracker/data";
import { StaffStudentTracker } from "./StaffStudentTracker";
import { getStudentInfoValues, plainValues, staffInfoAccess, visibleInfoFields } from "@/lib/students/extra-info";
import { fieldLabel, isMultilineField, isPhoneField } from "@/lib/students/extra-info-rules";
import { MissingInfoBadge, StudentInfoList } from "@/components/student-info/StudentInfoList";
import { Collapsible } from "@/components/collapsible/Collapsible";
import { SEGMENTS, countLabel } from "@/lib/text/count";

async function loginUrl(path: "/parent/login" | "/student/login") {
  const origin = await requestOrigin();
  return origin ? `${origin}${path}` : null;
}

export default async function StudentDetailPage({ params }: PageProps<"/students/[id]">) {
  const { id } = await params;
  const session = await requireSession();

  const student = await prisma.student.findFirst({
    where: { id, courseId: session.courseId },
    include: { planItems: { orderBy: { position: "asc" } }, group: { select: { gender: true } } },
  });
  if (!student) notFound();
  // an archived student's page is the supervisor's read-only view (from the archive)
  const archived = student.archivedAt !== null;
  if (archived && session.role !== "admin") redirect("/students");

  const viewer =
    session.role === "admin"
      ? await prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } })
      : await prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true } });

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    include: {
      pointsActivities: { orderBy: { sortOrder: "asc" } },
      groups: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, gender: true } },
    },
  });
  const groupLimit = await teacherGroupLimit(session, course);
  const canEdit = !archived && canEditStudents(session, course);
  const canArchive = !archived && canArchiveStudents(session, course);

  if (session.role === "teacher" && course.visibilityMode === "ASSIGNED") {
    const assignments = await prisma.teacherGroupAssignment.findMany({ where: { teacherId: session.teacherId } });
    if (assignments.length > 0 && !assignments.some((a) => a.groupId === student.groupId)) {
      redirect("/students");
    }
  }

  const today = todayDateOnly();
  const [sessions, pointsLogs, todayAttendance] = await Promise.all([
    prisma.recitationSession.findMany({
      where: { studentId: student.id },
      include: { teacher: { select: { name: true } } },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    }),
    prisma.pointsLog.findMany({
      where: { studentId: student.id },
      include: { teacher: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.attendanceLog.findMany({ where: { studentId: student.id, day: today } }),
  ]);

  const plan = student.planItems.map((pi) => pi.surahNumber);
  const reach = deriveReach(plan, sessions);
  const position = deriveCurrentPosition(plan, reach);

  const cumPages = sessions.reduce((sum, s) => sum + Number(s.pagesCalculated), 0);
  const onlineCount = sessions.filter((s) => s.mode === "ONLINE").length;
  const coverage = buildCoverage(sessions);
  const progressBars = computeProgressBars({ settings: course, plan, position, coverage });
  const overdueSurahs = computeOverdueSurahs(sessions, course.reviewReminderDays, today);
  const mistakes = await getActiveMistakes(student.id, plan);
  // the whole group is needed: a week with no class for the group is neutral
  const streak = course.streakMode
    ? {
        mode: course.streakMode,
        weeks:
          (
            await computeStreaks(
              course.streakMode,
              await prisma.student.findMany({
                where: { groupId: student.groupId, archivedAt: null },
                select: { id: true, groupId: true },
              }),
            )
          ).get(student.id) ?? 0,
      }
    : null;
  const cumPoints = pointsLogs.reduce((sum, p) => sum + (p.typeAtTime === "ADD" ? p.valueAtTime : -p.valueAtTime), 0);

  const g = student.group.gender;

  // «معلومات إضافية»: only the fields this viewer may see are loaded
  const infoAccess = staffInfoAccess(session, course);
  const infoFields = await visibleInfoFields(course.id, infoAccess);
  const infoStored = await getStudentInfoValues(student.id, infoFields);
  const canEditInfo = !archived && infoAccess.edit;
  const missingInfo = canEditInfo
    ? infoFields.filter((f) => f.required && !infoStored[f.id]).map((f) => fieldLabel(f, g))
    : [];
  const infoItems = infoFields
    .filter((f) => infoStored[f.id])
    .map((f) => ({
      id: f.id,
      label: fieldLabel(f, g),
      value: infoStored[f.id].value,
      phone: isPhoneField(f),
      multiline: isMultilineField(f),
      byParent: infoStored[f.id].updatedBy === "PARENT",
    }));

  const view = (
      <DetailView
        student={{
          id: student.id,
          name: student.name,
          age: student.age,
          grade: student.grade,
          attendance: attendanceStatusForDay(todayAttendance, today),
        }}
        groupGender={student.group.gender}
        viewerGender={viewer?.gender ?? null}
        plan={plan}
        position={position}
        reach={reach}
        cumPages={Math.round(cumPages * 1000) / 1000}
        cumPoints={cumPoints}
        streak={streak}
        onlineCount={onlineCount}
        coveredPages={coveredQuranPages(coverage)}
        totalPages={TOTAL_PAGES}
        progressBars={progressBars}
        memorizedRanges={coverageToRanges(coverage)}
        overdueSurahs={overdueSurahs}
        mistakes={mistakes}
        reviewReminderDays={course.reviewReminderDays}
        onlineRecitationEnabled={course.onlineRecitationEnabled}
        pointsActivities={course.pointsActivities.map((a) => ({
          id: a.id,
          name: a.name,
          value: a.value,
          type: a.type,
        }))}
        pointsLogs={pointsLogs.map((p) => ({
          activityId: p.activityId,
          date: p.day.toISOString().slice(0, 10),
          value: p.typeAtTime === "ADD" ? p.valueAtTime : -p.valueAtTime,
          bonus: p.activityId === null ? { id: p.id, note: p.note ?? "", teacherName: p.teacher.name } : undefined,
        }))}
        history={sessions.map((s) => ({
          id: s.id,
          date: s.occurredAt.toISOString().slice(0, 10),
          source: s.source,
          surahNumber: s.surahNumber,
          fromAyah: s.fromAyah,
          toAyah: s.toAyah,
          quality: s.quality,
          mode: s.mode,
          type: s.type,
          teacherName: s.teacher.name,
          notes: s.notes,
          reason: s.reason,
        }))}
        headerBadge={<MissingInfoBadge key="info-badge" missing={missingInfo} />}
        infoSection={
          infoItems.length > 0 ? (
            <Collapsible key="info-section" title="معلومات إضافية" defaultOpen={archived}>
              <StudentInfoList bare title="معلومات إضافية" items={infoItems} />
            </Collapsible>
          ) : null
        }
        expandAll={archived}
        headerActions={
          canEdit || canArchive ? (
            <StudentManageBar
              key="manage-bar"
              student={{ id: student.id, name: student.name, age: student.age, grade: student.grade, groupId: student.groupId }}
              groups={groupLimit ? course.groups.filter((x) => groupLimit.includes(x.id)) : course.groups}
              canEdit={canEdit}
              canArchive={canArchive}
              infoFields={canEditInfo ? infoFields : []}
              infoValues={canEditInfo ? plainValues(infoStored) : {}}
            />
          ) : null
        }
      />
  );

  if (archived) {
    return (
      <>
        <div className={styles.archivedBanner}>
          <span>
            🗄 {studentNounDef(g)} في الأرشيف منذ {student.archivedAt!.toISOString().slice(0, 10)} — هذه الصفحة للاطلاع
            فقط، ورمز ولي الأمر {pickByGroup(g, { m: "الخاص به", f: "الخاص بها" })} متوقف.
          </span>
          <Link href="/students/archive">→ العودة إلى الأرشيف</Link>
        </div>
        {/* inert: everything stays readable, nothing can be clicked or submitted */}
        <div inert className={styles.readOnly}>
          {view}
        </div>
      </>
    );
  }

  // home log: shown to every staff member who can see this student
  // (the page already sends teachers outside their groups away)
  const homeLog = course.homeLogEnabled && course.studentLoginEnabled ? await getHomeLog(student.id) : null;
  const assignments = course.assignmentsEnabled && course.studentLoginEnabled ? await getStudentAssignments(student.id) : null;
  const tracker = course.trackerEnabled && course.studentLoginEnabled ? await getStudentTracker(student.id) : null;

  return (
    <>
      {view}
      {/* collapsed like the sections above */}
      {homeLog && (
        <Collapsible
          title="🏠 حفظ البيت"
          tag={homeLog.active.length > 0 ? `${countLabel(homeLog.active.length, SEGMENTS)} قيد الحفظ` : "لا توجد مقاطع قيد الحفظ"}
        >
          <StaffHomeLog
            studentId={student.id}
            groupGender={g}
            log={homeLog}
            targets={await effectiveTargets(student.id)}
            hasOwnTargets={student.homeTargetListen !== null || student.homeTargetRepeat !== null || student.homeTargetRecite !== null}
          />
        </Collapsible>
      )}
      {assignments && (
        <Collapsible
          title="📝 الواجبات"
          tag={
            assignments.length > 0
              ? `${assignments.filter((a) => !a.done).length} مفتوحة · ${assignments.filter((a) => a.done).length} منجزة`
              : "لا توجد واجبات"
          }
        >
          <StaffStudentAssignments assignments={assignments} groupGender={g} />
        </Collapsible>
      )}
      {tracker && (
        <Collapsible title="✅ جدول المتابعة">
          <StaffStudentTracker sheet={tracker} groupId={student.groupId} />
        </Collapsible>
      )}
      {/* supervisor only: the code is never sent to a teacher's browser */}
      {session.role === "admin" && (
        <Collapsible title="رمز دخول وليّ الأمر">
          <ParentCodeCard
            studentId={student.id}
            groupGender={student.group.gender}
            initialCode={student.parentCode}
            initialCreatedAt={student.parentCodeCreatedAt?.toISOString() ?? null}
            loginUrl={await loginUrl("/parent/login")}
          />
        </Collapsible>
      )}
      {/* student login on, and the viewer may issue codes for this group */}
      {inScope(await studentCodeAccess(session), student.groupId) && (
        <Collapsible title={`رمز دخول ${studentNounDef(g)}`}>
          <StudentCodeCard
            studentId={student.id}
            groupGender={student.group.gender}
            initialCode={student.studentCode}
            initialCreatedAt={student.studentCodeCreatedAt?.toISOString() ?? null}
            loginUrl={await loginUrl("/student/login")}
          />
        </Collapsible>
      )}
    </>
  );
}
