import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require";
import { supervisorNoun } from "@/lib/text/gender";
import styles from "./settings.module.css";
import { CourseCodeBox } from "./CourseCodeBox";
import { BoardCodeCard } from "./BoardCodeCard";
import { PermissionsCard } from "./PermissionsCard";
import { OnlineToggle } from "./OnlineToggle";
import { GroupsEditor } from "./GroupsEditor";
import { ProgressBarsCard } from "./ProgressBarsCard";
import { ReviewReminderCard } from "./ReviewReminderCard";
import { StreakCard } from "./StreakCard";
import { PointsEditor } from "./PointsEditor";
import { CalendarCard } from "./CalendarCard";
import { StudentLoginCard } from "./StudentLoginCard";
import { StudentInfoCard } from "./StudentInfoCard";
import { requestOrigin } from "@/lib/request-origin";
import { ensureBuiltinFields, getCourseInfoFields } from "@/lib/students/extra-info";
import { Collapsible } from "@/components/collapsible/Collapsible";
import { onOffTag } from "@/components/collapsible/tags";
import { ACTIVITIES, GROUPS, countLabel } from "@/lib/text/count";

export default async function SettingsPage() {
  const session = await requireAdmin();

  const [course, admin, origin] = await Promise.all([
    prisma.course.findUniqueOrThrow({
      where: { id: session.courseId },
      include: {
        groups: { orderBy: { sortOrder: "asc" } },
        pointsActivities: { orderBy: { sortOrder: "asc" } },
        teachers: {
          // the supervisor's own stand-in row isn't a teacher to assign groups to
          where: { isSupervisorProxy: false },
          orderBy: { name: "asc" },
          include: { groupAssignments: true },
        },
      },
    }),
    prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } }),
    requestOrigin(),
  ]);
  // built-in rows normally exist from the moment the feature was turned on;
  // this also adds any built-in field introduced later (idempotent)
  if (course.studentInfoEnabled) await ensureBuiltinFields(course.id);
  const infoFields = course.studentInfoEnabled ? await getCourseInfoFields(course.id) : [];
  const progressBarsOn = [course.showSurahProgress, course.showJuzProgress, course.showQuranProgress, course.showPlanProgress].filter(
    Boolean,
  ).length;

  return (
    <div>
      <div className={styles.subtitle}>
        إعدادات دورة {course.name} (تظهر لل{supervisorNoun(admin?.gender ?? null)} فقط)
      </div>

      {/* Every card starts collapsed; the header tag shows its master switch
          (or a short summary). Only the layout changed, not the settings. */}
      <Collapsible title="رمز الدورة للمعلمين">
        <CourseCodeBox courseName={course.name} code={course.code} adminGender={admin?.gender ?? null} />
      </Collapsible>

      <Collapsible title="رمز لوحة الإنجاز العامة" {...onOffTag(course.boardCode !== null)}>
        <BoardCodeCard
          initialCode={course.boardCode}
          initialCreatedAt={course.boardCodeCreatedAt?.toISOString() ?? null}
          loginUrl={origin ? `${origin}/board/login` : null}
        />
      </Collapsible>

      <Collapsible title="صلاحيات المعلمين">
        <PermissionsCard
          addStudentsPermission={course.addStudentsPermission}
          editStudentsPermission={course.editStudentsPermission}
          archiveStudentsPermission={course.archiveStudentsPermission}
          addPriorPermission={course.addPriorPermission}
          issueStudentCodesPermission={course.issueStudentCodesPermission}
          studentLoginEnabled={course.studentLoginEnabled}
          studentInfoEnabled={course.studentInfoEnabled}
          adminGender={admin?.gender ?? null}
          visibilityMode={course.visibilityMode}
          groups={course.groups.map((g) => ({ id: g.id, name: g.name }))}
          teachers={course.teachers.map((t) => ({
            id: t.id,
            name: t.name,
            groupId: t.groupAssignments[0]?.groupId ?? null,
          }))}
        />
      </Collapsible>

      <Collapsible title="أنواع التسميع" tag={course.onlineRecitationEnabled ? "الأونلاين مفعّل" : "الأونلاين غير مفعّل"} tagTone={course.onlineRecitationEnabled ? "on" : "off"}>
        <OnlineToggle enabled={course.onlineRecitationEnabled} />
      </Collapsible>

      <Collapsible
        title="أشرطة التقدّم"
        {...(progressBarsOn > 0 ? { tag: `${progressBarsOn} من 4`, tagTone: "on" as const } : onOffTag(false))}
      >
        <ProgressBarsCard
          enabled={{
            showSurahProgress: course.showSurahProgress,
            showJuzProgress: course.showJuzProgress,
            showQuranProgress: course.showQuranProgress,
            showPlanProgress: course.showPlanProgress,
          }}
        />
      </Collapsible>

      <Collapsible title="تذكير المراجعة" {...onOffTag(course.reviewReminderDays !== null)}>
        <ReviewReminderCard days={course.reviewReminderDays} />
      </Collapsible>

      <Collapsible title="الأسابيع المتتالية 🔥" {...onOffTag(course.streakMode !== null)}>
        <StreakCard mode={course.streakMode} />
      </Collapsible>

      <Collapsible title="دخول الطلاب" {...onOffTag(course.studentLoginEnabled)}>
        <StudentLoginCard
          enabled={course.studentLoginEnabled}
          boardEnabled={course.studentBoardEnabled}
          homeLogEnabled={course.homeLogEnabled}
          homeTargets={{ listen: course.homeTargetListen, repeat: course.homeTargetRepeat, recite: course.homeTargetRecite }}
          homeMistakesEnabled={course.homeMistakesEnabled}
          assignmentsEnabled={course.assignmentsEnabled}
          trackerEnabled={course.trackerEnabled}
        />
      </Collapsible>

      <Collapsible title="معلومات إضافية" {...onOffTag(course.studentInfoEnabled)}>
        <StudentInfoCard
          enabled={course.studentInfoEnabled}
          parentEdit={course.parentStudentInfoEdit}
          fields={infoFields}
          adminGender={admin?.gender ?? null}
        />
      </Collapsible>

      <Collapsible title="التقويم الهجري" {...onOffTag(course.calendarEnabled)}>
        <CalendarCard
          enabled={course.calendarEnabled}
          bannerEnabled={course.calendarBannerEnabled}
          editPermission={course.calendarEditPermission}
          adminGender={admin?.gender ?? null}
        />
      </Collapsible>

      <Collapsible title="مجموعات الدورة" tag={course.groups.length > 0 ? countLabel(course.groups.length, GROUPS) : "لا توجد مجموعات"}>
        <GroupsEditor groups={course.groups.map((g) => ({ id: g.id, name: g.name, gender: g.gender }))} />
      </Collapsible>

      <Collapsible
        title="نظام النقاط"
        tag={course.pointsActivities.length > 0 ? countLabel(course.pointsActivities.length, ACTIVITIES) : "لا توجد أنشطة"}
      >
        <PointsEditor
          activities={course.pointsActivities.map((a) => ({
            id: a.id,
            name: a.name,
            value: a.value,
            type: a.type,
          }))}
        />
      </Collapsible>
    </div>
  );
}
