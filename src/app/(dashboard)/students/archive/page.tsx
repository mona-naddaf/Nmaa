import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require";
import { ArchiveList } from "./ArchiveList";
import styles from "../[id]/manage.module.css";

// Supervisor-only (also guarded in proxy.ts): archived students, with
// restore, the per-student "keep in reports" choice, and permanent delete.
export default async function ArchivePage() {
  const session = await requireAdmin();
  const students = await prisma.student.findMany({
    where: { courseId: session.courseId, archivedAt: { not: null } },
    orderBy: { archivedAt: "desc" },
    select: {
      id: true,
      name: true,
      grade: true,
      archivedAt: true,
      keepInReports: true,
      group: { select: { name: true, gender: true } },
    },
  });

  return (
    <div>
      <div className={styles.archivedBanner} style={{ background: "var(--paper)", borderColor: "var(--line)" }}>
        <span>
          🗄 <b>الأرشيف</b> — الطلاب المؤرشفون مخفيون من كل القوائم ولوحة الإنجاز، وتبقى بياناتهم محفوظة. يمكن
          استعادة أي منهم، أو حذفه نهائيًا مع كل بياناته.
        </span>
        <Link href="/students">→ رجوع لقائمة الطلاب</Link>
      </div>
      <ArchiveList
        students={students.map((s) => ({
          id: s.id,
          name: s.name,
          grade: s.grade,
          groupName: s.group.name,
          gender: s.group.gender,
          archivedAt: s.archivedAt!.toISOString().slice(0, 10),
          keepInReports: s.keepInReports,
        }))}
      />
    </div>
  );
}
