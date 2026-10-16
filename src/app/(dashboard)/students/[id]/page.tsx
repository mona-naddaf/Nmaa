import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { deriveCurrentPosition, deriveReach } from "@/lib/recitation/logic";
import { getActiveMistakes } from "@/lib/students/mistakes";
import { computeStreaks } from "@/lib/students/streak-data";
import { attendanceStatusForDay } from "@/lib/attendance";
import { courseTimeZone } from "@/lib/time/course-zone";
import { zoneDateOnly, zoneDayOf, zoneToday } from "@/lib/time/zone";
import { SURAH_NAME, TOTAL_PAGES } from "@/lib/quran-data";
import { juzGroupSurahs } from "@/lib/quran-data/juz";
import { DIRECTIONAL_JUZ } from "@/lib/recitation/juz-direction";
import { entryCount, groupCombos } from "@/lib/recitation/combined";
import { latestTrackBySurah, trackContext } from "@/lib/recitation/tracks";
import type { SecondTrackForm } from "@/components/recitation/RecitationEntry";
import { PLAN_TEMPLATE_LABEL, TEMPLATE_KEY_PLAN, type TemplateKey } from "@/lib/students/new-student";
import { PlanPanel } from "./PlanPanel";
import { buildCoverage, computeProgressBars, coverageToRanges, coveredQuranPages, secondTrackBar } from "@/lib/students/progress";
import { computeOverdueSurahs } from "@/lib/students/review";
import { PLAN_INCLUDE, forPlanPosition, secondTrackView, studentPlan } from "@/lib/students/plan";
import { DetailView } from "./DetailView";
import { ParentCodeCard } from "./ParentCodeCard";
import { StudentCodeCard } from "./StudentCodeCard";
import { StaffHomeLog } from "./StaffHomeLog";
import { effectiveTargets, getHomeLog } from "@/lib/home-log/data";
import { inScope, studentCodeAccess } from "@/lib/students/student-codes";
import { StudentManageBar } from "./StudentManageBar";
import { requestOrigin } from "@/lib/request-origin";
import styles from "./manage.module.css";
import { canAddPrior, canArchiveStudents, canEditPlan, canEditStudents, teacherGroupLimit } from "@/lib/students/manage";
import { pickByGroup, studentNounDef } from "@/lib/text/gender";
import { getStudentAssignments } from "@/lib/assignments/data";
import { StaffStudentAssignments } from "./StaffStudentAssignments";
import { getStudentTracker } from "@/lib/tracker/data";
import { courseSummary } from "@/lib/tracker/summary-data";
import { TrackerSummary } from "@/components/student-work/TrackerSummary";
import { studentSummaryAction } from "./summary-actions";
import { StaffStudentTracker } from "./StaffStudentTracker";
import { getStudentInfoValues, plainValues, staffInfoAccess, visibleInfoFields } from "@/lib/students/extra-info";
import { fieldLabel, isMultilineField, isPhoneField } from "@/lib/students/extra-info-rules";
import { MissingInfoBadge, StudentInfoList } from "@/components/student-info/StudentInfoList";
import { Collapsible } from "@/components/collapsible/Collapsible";
import { SEGMENTS, countLabel } from "@/lib/text/count";
import { getStudentGoal } from "@/lib/goals/data";
import { onOffTag } from "@/components/collapsible/tags";
import { TajweedDetailToggle } from "./TajweedDetailToggle";

async function loginUrl(path: "/parent/login" | "/student/login") {
  const origin = await requestOrigin();
  return origin ? `${origin}${path}` : null;
}

export default async function StudentDetailPage({ params }: PageProps<"/students/[id]">) {
  const { id } = await params;
  const session = await requireSession();

  const student = await prisma.student.findFirst({
    where: { id, courseId: session.courseId },
    include: { ...PLAN_INCLUDE, group: { select: { gender: true } } },
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
  const canManagePrior = !archived && canAddPrior(session, course);
  const canChangePlan = !archived && canEditPlan(session, course);

  if (session.role === "teacher" && course.visibilityMode === "ASSIGNED") {
    const assignments = await prisma.teacherGroupAssignment.findMany({ where: { teacherId: session.teacherId } });
    if (assignments.length > 0 && !assignments.some((a) => a.groupId === student.groupId)) {
      redirect("/students");
    }
  }

  // today and every day below: the course's days (lib/time/zone.ts)
  const timeZone = await courseTimeZone(course.id);
  const today = zoneToday(timeZone);
  const attendanceToday = zoneDateOnly(timeZone);
  const dayOf = (d: Date) => zoneDayOf(timeZone, d);
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
    prisma.attendanceLog.findMany({ where: { studentId: student.id, day: attendanceToday } }),
  ]);

  const sp = studentPlan(student);
  const plan = sp.plan;
  const positionSessions = forPlanPosition(sessions, sp.planChangedAt);
  const reach = deriveReach(plan, positionSessions);
  const position = deriveCurrentPosition(plan, reach);

  const cumPages = sessions.reduce((sum, s) => sum + Number(s.pagesCalculated), 0);
  // a combined entry (one recitation saved as parts) counts once
  const onlineCount = entryCount(sessions.filter((s) => s.mode === "ONLINE"));
  const coverage = buildCoverage(sessions);
  const progressBars = computeProgressBars({ settings: course, plan, position, coverage });
  // her second track, if any: its position line, its bar, and what the form needs
  const second = secondTrackView(sp, sessions, student.group.gender);
  if (second?.progress?.position) progressBars.push(secondTrackBar(second.progress.position));
  const secondCtx = sp.second ? trackContext(sp.second, sessions) : null;
  const secondForm: SecondTrackForm | null = sp.second
    ? { kind: sp.second.kind, ctx: secondCtx, latest: latestTrackBySurah(sessions, sp.second.id), next: second?.progress?.next ?? null }
    : null;
  const overdueSurahs = computeOverdueSurahs(sessions, course.reviewReminderDays, today, (s) => dayOf(s.occurredAt));
  const mistakes = await getActiveMistakes(student.id, plan);
  // her memorization goal, if any (lib/goals/goal.ts)
  const goal = await getStudentGoal(student.id, plan, sessions, timeZone);
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
              timeZone,
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
        today={today}
        student={{
          id: student.id,
          name: student.name,
          age: student.age,
          grade: student.grade,
          attendance: attendanceStatusForDay(todayAttendance, attendanceToday),
        }}
        groupGender={student.group.gender}
        viewerGender={viewer?.gender ?? null}
        plan={plan}
        position={position}
        reach={reach}
        directional={
          sp.directions
            ? {
                directions: sp.directions,
                sessions: positionSessions.map((s) => ({
                  surahNumber: s.surahNumber,
                  fromAyah: s.fromAyah,
                  toAyah: s.toAyah,
                  type: s.type,
                  situation: s.situation,
                  reason: s.reason,
                })),
              }
            : null
        }
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
        secondTrack={second ? { title: second.title, positionText: second.positionText } : null}
        secondForm={secondForm}
        goal={goal?.view ?? null}
        reviewReminderDays={course.reviewReminderDays}
        onlineRecitationEnabled={course.onlineRecitationEnabled}
        similarEnabled={course.mutashabihatTeachersEnabled}
        tajweedDetail={course.tajweedDetailEnabled && student.tajweedDetailed}
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
        history={groupCombos(sessions).map((s) => ({
          id: s.id,
          date: dayOf(s.occurredAt),
          source: s.source,
          surahNumber: s.surahNumber,
          fromAyah: s.fromAyah,
          toAyah: s.toAyah,
          quality: s.quality,
          mode: s.mode,
          type: s.type,
          teacherName: s.teacher.name,
          // a combined entry: its parts, with the notes and reason they carry
          notes: s.parts ? (s.parts.find((p) => p.notes)?.notes ?? null) : s.notes,
          reason: s.parts ? (s.parts.find((p) => p.reason)?.reason ?? null) : s.reason,
          ...(s.parts ? { parts: s.parts.map((p) => ({ type: p.type, fromAyah: p.fromAyah, toAyah: p.toAyah })) } : {}),
        }))}
        headerBadge={<MissingInfoBadge key="info-badge" missing={missingInfo} />}
        infoSection={
          infoItems.length > 0 ? (
            <Collapsible
              key="info-section"
              title="معلومات إضافية"
              {...(archived ? { defaultOpen: true } : { persistKey: "student.info" })}
            >
              <StudentInfoList bare title="معلومات إضافية" items={infoItems} />
            </Collapsible>
          ) : null
        }
        canManagePrior={canManagePrior}
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
            🗄 {studentNounDef(g)} في الأرشيف منذ {dayOf(student.archivedAt!)} — هذه الصفحة للاطلاع
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

  // «خطة الحفظ»: the juz rows only for a plan with directions
  const juzRows = sp.directions
    ? DIRECTIONAL_JUZ.map((juz) => {
        const surahs = juzGroupSurahs(juz);
        const row = student.juzDirections.find((d) => d.juz === juz);
        return {
          juz,
          first: SURAH_NAME[surahs[0]],
          last: SURAH_NAME[surahs[surahs.length - 1]],
          direction: row?.direction ?? null,
          manual: row?.source === "MANUAL",
          started: surahs.some((s) => coverage.has(s)),
        };
      })
    : null;
  const storedPlan = student.planItems.map((p) => p.surahNumber);
  const templateKey = (Object.keys(TEMPLATE_KEY_PLAN) as TemplateKey[]).find((k) => TEMPLATE_KEY_PLAN[k] === student.planTemplate) ?? "custom";

  // home log: shown to every staff member who can see this student
  // (the page already sends teachers outside their groups away)
  const homeLog = course.homeLogEnabled && course.studentLoginEnabled ? await getHomeLog(student.id) : null;
  const assignments = course.assignmentsEnabled && course.studentLoginEnabled ? await getStudentAssignments(student.id) : null;
  const tracker = course.trackerEnabled && course.studentLoginEnabled ? await getStudentTracker(student.id) : null;
  // «المحصّلات» (course setting, with the tracker)
  const summary = tracker && course.trackerSummaryEnabled ? await courseSummary(student.id, "month", 0) : null;

  return (
    <>
      {view}
      {/* collapsed like the sections above */}
      <Collapsible title="🗺 خطة الحفظ" persistKey="student.plan" tag={PLAN_TEMPLATE_LABEL[student.planTemplate]}>
        <PlanPanel
          studentId={student.id}
          groupGender={g}
          viewerGender={viewer?.gender ?? null}
          templateKey={templateKey}
          templateLabel={PLAN_TEMPLATE_LABEL[student.planTemplate]}
          storedPlan={storedPlan}
          juzRows={juzRows}
          editedReverse={student.planTemplate === "MUSHAF_REVERSE" && !sp.directions}
          canEdit={canChangePlan}
          secondTrack={second ? { title: second.title, positionText: second.positionText, done: second.done } : null}
          goalPlan={plan}
          goal={goal ? { target: goal.spec.target, juz: goal.spec.juz, surah: goal.spec.surah, ayah: goal.spec.ayah, deadline: goal.spec.deadline } : null}
          today={today}
        />
      </Collapsible>
      {/* «أخطاء التجويد المفصّلة» on in the course: who is held to it (lib/tajweed) */}
      {course.tajweedDetailEnabled && (
        <Collapsible title="🎯 التجويد المفصّل" persistKey="student.tajweedDetail" {...onOffTag(student.tajweedDetailed)}>
          <TajweedDetailToggle studentId={student.id} groupGender={g} initial={student.tajweedDetailed} />
        </Collapsible>
      )}
      {homeLog && (
        <Collapsible
          title="🏠 حفظ البيت"
          persistKey="student.homeLog"
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
          persistKey="student.assignments"
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
        <Collapsible title="✅ جدول المتابعة" persistKey="student.tracker">
          <StaffStudentTracker sheet={tracker} groupId={student.groupId} />
        </Collapsible>
      )}
      {summary && (
        <Collapsible title="📊 المحصّلات" persistKey="student.summary">
          <TrackerSummary initial={summary} groupGender={student.group.gender} self={false} load={studentSummaryAction.bind(null, student.id)} />
        </Collapsible>
      )}
      {/* supervisor only: the code is never sent to a teacher's browser */}
      {session.role === "admin" && (
        <Collapsible title="رمز دخول وليّ الأمر" persistKey="student.parentCode">
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
        <Collapsible title={`رمز دخول ${studentNounDef(g)}`} persistKey="student.studentCode">
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
