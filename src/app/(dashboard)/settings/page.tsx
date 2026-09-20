import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require";
import styles from "./settings.module.css";
import { CourseCodeBox } from "./CourseCodeBox";
import { PermissionsCard } from "./PermissionsCard";
import { OnlineToggle } from "./OnlineToggle";
import { GroupsEditor } from "./GroupsEditor";
import { PointsEditor } from "./PointsEditor";

export default async function SettingsPage() {
  const session = await requireAdmin();

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    include: {
      groups: { orderBy: { sortOrder: "asc" } },
      pointsActivities: { orderBy: { sortOrder: "asc" } },
      teachers: {
        orderBy: { name: "asc" },
        include: { groupAssignments: true },
      },
    },
  });

  return (
    <div>
      <div className={styles.subtitle}>إعدادات دورة {course.name} (تظهر للمديرة فقط)</div>

      <CourseCodeBox courseName={course.name} code={course.code} />

      <div className={styles.secTitle}>
        <span className={styles.dot} /> صلاحيات المعلمات
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
        <span className={styles.dot} /> مجموعات الدورة
      </div>
      <div className={styles.card}>
        <GroupsEditor groups={course.groups.map((g) => ({ id: g.id, name: g.name }))} />
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
