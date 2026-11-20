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
import { SimilarCard } from "./SimilarCard";
import { TajweedDetailCard } from "./TajweedDetailCard";

/** «المتشابهات» card header: who sees the marks. */
function similarTag(teachers: boolean, students: boolean): { tag: string; tagTone: "on" | "off" } {
  if (teachers && students) return { tag: "للمعلمين والطلاب", tagTone: "on" };
  if (teachers) return { tag: "للمعلمين", tagTone: "on" };
  if (students) return { tag: "للطلاب", tagTone: "on" };
  return { tag: "غير مفعّل", tagTone: "off" };
}
import { ACTIVITIES, GROUPS, countLabel } from "@/lib/text/count";
import { TimeZoneCard } from "./TimeZoneCard";
import { ExcuseCard } from "./ExcuseCard";
import { excuseAllowed } from "@/lib/excuse/enabled";
import { COURSE_EXCUSE_GIRLS_ONLY, EXCUSE_TITLE } from "@/lib/excuse/texts";
import { safeTimeZone } from "@/lib/time/zone";
import { COMMON_ZONES, zoneLabel } from "@/lib/time/zones";
import { zoneOffsetLabel } from "@/lib/time/zone";
import { locationOf } from "@/lib/prayer/location";
import { courseGuideAllowed } from "@/lib/guide/course-enabled";
import { LeaveGuard } from "@/components/leave-guard/LeaveGuard";
import { targetAttr } from "@/lib/guide/help/targets";
import { CardFocus } from "./live/CardFocus";
import { Suspense } from "react";
import {
  LiveCalendar,
  LiveExcuse,
  LiveOnline,
  LivePermissions,
  LiveProgressBars,
  LiveReview,
  LiveSimilar,
  LiveStreak,
  LiveStudentLogin,
  LiveTajweed,
} from "./live/LiveCards";

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
    prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true, email: true } }),
    requestOrigin(),
  ]);
  // built-in rows normally exist from the moment the feature was turned on;
  // this also adds any built-in field introduced later (idempotent)
  if (course.studentInfoEnabled) await ensureBuiltinFields(course.id);
  const infoFields = course.studentInfoEnabled ? await getCourseInfoFields(course.id) : [];
  const progressBarsOn = [course.showSurahProgress, course.showJuzProgress, course.showQuranProgress, course.showPlanProgress].filter(
    Boolean,
  ).length;

  // COURSE_GUIDE_EMAILS: the choices saved at once (./live), until they open to everyone
  const live = courseGuideAllowed(admin?.email);
  const ag = admin?.gender ?? null;
  const permissions = {
    addStudentsPermission: course.addStudentsPermission,
    editStudentsPermission: course.editStudentsPermission,
    archiveStudentsPermission: course.archiveStudentsPermission,
    addPriorPermission: course.addPriorPermission,
    offlineSheetPermission: course.offlineSheetPermission,
    editPlanPermission: course.editPlanPermission,
    issueStudentCodesPermission: course.issueStudentCodesPermission,
    studentLoginEnabled: course.studentLoginEnabled,
    studentInfoEnabled: course.studentInfoEnabled,
    adminGender: ag,
    visibilityMode: course.visibilityMode,
    groups: course.groups.map((g) => ({ id: g.id, name: g.name })),
    teachers: course.teachers.map((t) => ({ id: t.id, name: t.name, groupId: t.groupAssignments[0]?.groupId ?? null })),
  };
  const bars = {
    showSurahProgress: course.showSurahProgress,
    showJuzProgress: course.showJuzProgress,
    showQuranProgress: course.showQuranProgress,
    showPlanProgress: course.showPlanProgress,
  };
  const login = {
    enabled: course.studentLoginEnabled,
    boardEnabled: course.studentBoardEnabled,
    homeLogEnabled: course.homeLogEnabled,
    homeTargets: { listen: course.homeTargetListen, repeat: course.homeTargetRepeat, recite: course.homeTargetRecite },
    homeMistakesEnabled: course.homeMistakesEnabled,
    assignmentsEnabled: course.assignmentsEnabled,
    trackerEnabled: course.trackerEnabled,
    trackerAgendaEnabled: course.trackerAgendaEnabled,
    trackerSummaryEnabled: course.trackerSummaryEnabled,
  };

  if (live)
    return (
      <div>
        {/* a choice still saving: leaving warns first */}
        <LeaveGuard you={ag ?? "FEMALE"} />
        {/* «تفعيل الآن» in the help: ?card=… opens that card */}
        <Suspense fallback={null}>
          <CardFocus />
        </Suspense>
        <div className={styles.subtitle}>
          إعدادات دورة {course.name} (تظهر لل{supervisorNoun(ag)} فقط)
        </div>
        <Collapsible id="card-code" target={targetAttr("c.card.code", true)} title="رمز الدورة للمعلمين">
          <CourseCodeBox courseName={course.name} code={course.code} adminGender={ag} />
        </Collapsible>
        <Collapsible id="card-board" target={targetAttr("c.card.board", true)} title="رمز لوحة الإنجاز العامة" {...onOffTag(course.boardCode !== null)}>
          <BoardCodeCard
            initialCode={course.boardCode}
            initialCreatedAt={course.boardCodeCreatedAt?.toISOString() ?? null}
            loginUrl={origin ? `${origin}/board/login` : null}
          />
        </Collapsible>
        <Collapsible id="card-perms" target={targetAttr("c.card.perms", true)} title="صلاحيات المعلمين">
          <LivePermissions {...permissions} />
        </Collapsible>
        <Collapsible id="card-online" target={targetAttr("c.card.online", true)} title="أنواع التسميع" tag={course.onlineRecitationEnabled ? "الأونلاين مفعّل" : "الأونلاين غير مفعّل"} tagTone={course.onlineRecitationEnabled ? "on" : "off"}>
          <LiveOnline enabled={course.onlineRecitationEnabled} />
        </Collapsible>
        <Collapsible id="card-progress" target={targetAttr("c.card.progress", true)} title="أشرطة التقدّم" {...(progressBarsOn > 0 ? { tag: `${progressBarsOn} من 4`, tagTone: "on" as const } : onOffTag(false))}>
          <LiveProgressBars enabled={bars} />
        </Collapsible>
        <Collapsible id="card-timezone" target={targetAttr("c.card.timezone", true)} title="التوقيت" tag={zoneLabel(safeTimeZone(course.timeZone))}>
          <TimeZoneCard
            timeZone={safeTimeZone(course.timeZone)}
            currentLabel={zoneLabel(safeTimeZone(course.timeZone))}
            offsets={Object.fromEntries([...COMMON_ZONES.map((z) => z.id), safeTimeZone(course.timeZone)].map((id) => [id, zoneOffsetLabel(id)]))}
            place={locationOf(course)}
          />
        </Collapsible>
        {excuseAllowed(admin?.email) && (
          <Collapsible id="card-excuse" target={targetAttr("c.card.excuse", true)} title={`${EXCUSE_TITLE} · ${COURSE_EXCUSE_GIRLS_ONLY}`} {...onOffTag(course.excuseEnabled)}>
            <LiveExcuse enabled={course.excuseEnabled} trackerEnabled={course.trackerEnabled} adminGender={ag} />
          </Collapsible>
        )}
        <Collapsible id="card-review" target={targetAttr("c.card.review", true)} title="تذكير المراجعة" {...onOffTag(course.reviewReminderDays !== null)}>
          <LiveReview days={course.reviewReminderDays} adminGender={ag} />
        </Collapsible>
        <Collapsible id="card-streak" target={targetAttr("c.card.streak", true)} title="الأسابيع المتتالية 🔥" {...onOffTag(course.streakMode !== null)}>
          <LiveStreak mode={course.streakMode} />
        </Collapsible>
        <Collapsible id="card-studentLogin" target={targetAttr("c.card.studentLogin", true)} title="دخول الطلاب" {...onOffTag(course.studentLoginEnabled)}>
          <LiveStudentLogin {...login} />
        </Collapsible>
        <Collapsible id="card-similar" target={targetAttr("c.card.similar", true)} title="المتشابهات" {...similarTag(course.mutashabihatTeachersEnabled, course.mutashabihatStudentsEnabled)}>
          <LiveSimilar
            teachers={course.mutashabihatTeachersEnabled}
            students={course.mutashabihatStudentsEnabled}
            studentLoginEnabled={course.studentLoginEnabled}
            homeLogEnabled={course.homeLogEnabled}
          />
        </Collapsible>
        <Collapsible id="card-tajweed" target={targetAttr("c.card.tajweed", true)} title="أخطاء التجويد المفصّلة" {...onOffTag(course.tajweedDetailEnabled)}>
          <LiveTajweed enabled={course.tajweedDetailEnabled} />
        </Collapsible>
        <Collapsible id="card-info" target={targetAttr("c.card.info", true)} title="معلومات إضافية" {...onOffTag(course.studentInfoEnabled)}>
          <StudentInfoCard enabled={course.studentInfoEnabled} parentEdit={course.parentStudentInfoEdit} fields={infoFields} adminGender={ag} />
        </Collapsible>
        <Collapsible id="card-calendar" target={targetAttr("c.card.calendar", true)} title="التقويم الهجري" {...onOffTag(course.calendarEnabled)}>
          <LiveCalendar enabled={course.calendarEnabled} bannerEnabled={course.calendarBannerEnabled} editPermission={course.calendarEditPermission} adminGender={ag} />
        </Collapsible>
        <Collapsible id="card-groups" target={targetAttr("c.card.groups", true)} title="مجموعات الدورة" tag={course.groups.length > 0 ? countLabel(course.groups.length, GROUPS) : "لا توجد مجموعات"}>
          <GroupsEditor groups={course.groups.map((g) => ({ id: g.id, name: g.name, gender: g.gender }))} />
        </Collapsible>
        <Collapsible id="card-points" target={targetAttr("c.card.points", true)} title="نظام النقاط" tag={course.pointsActivities.length > 0 ? countLabel(course.pointsActivities.length, ACTIVITIES) : "لا توجد أنشطة"}>
          <PointsEditor activities={course.pointsActivities.map((a) => ({ id: a.id, name: a.name, value: a.value, type: a.type }))} />
        </Collapsible>
      </div>
    );

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
          offlineSheetPermission={course.offlineSheetPermission}
          editPlanPermission={course.editPlanPermission}
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

      <Collapsible title="التوقيت" tag={zoneLabel(safeTimeZone(course.timeZone))}>
        <TimeZoneCard
          timeZone={safeTimeZone(course.timeZone)}
          currentLabel={zoneLabel(safeTimeZone(course.timeZone))}
          offsets={Object.fromEntries([...COMMON_ZONES.map((z) => z.id), safeTimeZone(course.timeZone)].map((id) => [id, zoneOffsetLabel(id)]))}
          place={locationOf(course)}
        />
      </Collapsible>

      {excuseAllowed(admin?.email) && (
        <Collapsible title={`${EXCUSE_TITLE} · ${COURSE_EXCUSE_GIRLS_ONLY}`} {...onOffTag(course.excuseEnabled)}>
          <ExcuseCard enabled={course.excuseEnabled} trackerEnabled={course.trackerEnabled} adminGender={admin?.gender ?? null} />
        </Collapsible>
      )}

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
          trackerAgendaEnabled={course.trackerAgendaEnabled}
          trackerSummaryEnabled={course.trackerSummaryEnabled}
        />
      </Collapsible>

      <Collapsible title="المتشابهات" {...similarTag(course.mutashabihatTeachersEnabled, course.mutashabihatStudentsEnabled)}>
        <SimilarCard
          teachers={course.mutashabihatTeachersEnabled}
          students={course.mutashabihatStudentsEnabled}
          studentLoginEnabled={course.studentLoginEnabled}
          homeLogEnabled={course.homeLogEnabled}
        />
      </Collapsible>

      <Collapsible title="أخطاء التجويد المفصّلة" {...onOffTag(course.tajweedDetailEnabled)}>
        <TajweedDetailCard enabled={course.tajweedDetailEnabled} />
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
