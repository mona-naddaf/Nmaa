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
import { PointsEditor } from "./PointsEditor";

export default async function SettingsPage() {
  const session = await requireAdmin();

  const [course, admin] = await Promise.all([
    prisma.course.findUniqueOrThrow({
      where: { id: session.courseId },
      include: {
        groups: { orderBy: { sortOrder: "asc" } },
        pointsActivities: { orderBy: { sortOrder: "asc" } },
        teachers: {
          orderBy: { name: "asc" },
          include: { groupAssignments: true },
        },
      },
    }),
    prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } }),
  ]);

  return (
    <div>
      <div className={styles.subtitle}>
        إعدادات دورة {course.name} (تظهر لل{supervisorNoun(admin?.gender ?? null)} فقط)
      </div>

      <CourseCodeBox courseName={course.name} code={course.code} adminGender={admin?.gender ?? null} />
      <BoardCodeCard
        initialCode={course.boardCode}
        initialCreatedAt={course.boardCodeCreatedAt?.toISOString() ?? null}
      />

      <div className={styles.secTitle}>
        <span className={styles.dot} /> صلاحيات المعلمين
      </div>
      <PermissionsCard
        addStudentsPermission={course.addStudentsPermission}
        visibilityMode={course.visibilityMode}
        groups={course.groups.map((g) => ({ id: g.id, name: g.name }))}
        teachers={course.teachers.map((t) => ({
          id: t.id,
          name: t.name,
          groupId: t.groupAssignments[0]?.groupId ?? null,
        }))}
      />

      <div className={styles.secTitle}>
        <span className={styles.dot} /> أنواع التسميع
      </div>
      <div className={styles.card}>
        <OnlineToggle enabled={course.onlineRecitationEnabled} />
      </div>

      <div className={styles.secTitle}>
        <span className={styles.dot} /> أشرطة التقدّم
      </div>
      <div className={styles.card}>
        <ProgressBarsCard
          enabled={{
            showSurahProgress: course.showSurahProgress,
            showJuzProgress: course.showJuzProgress,
            showQuranProgress: course.showQuranProgress,
            showPlanProgress: course.showPlanProgress,
          }}
        />
      </div>

      <div className={styles.secTitle}>
        <span className={styles.dot} /> تذكير المراجعة
      </div>
      <div className={styles.card}>
        <ReviewReminderCard days={course.reviewReminderDays} />
      </div>

      <div className={styles.secTitle}>
        <span className={styles.dot} /> مجموعات الدورة
      </div>
      <div className={styles.card}>
        <GroupsEditor groups={course.groups.map((g) => ({ id: g.id, name: g.name, gender: g.gender }))} />
      </div>

      <div className={styles.secTitle}>
        <span className={styles.dot} /> نظام النقاط
      </div>
      <div className={styles.card}>
        <PointsEditor
          activities={course.pointsActivities.map((a) => ({
            id: a.id,
            name: a.name,
            value: a.value,
            type: a.type,
          }))}
        />
      </div>
    </div>
  );
}
