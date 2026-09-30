import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { isSiteOwner } from "@/lib/resources/access";
import { creatorLabel } from "@/lib/resources/data";
import { urlHost } from "@/lib/resources/validate";
import styles from "../bank.module.css";
import { Moderation } from "./Moderation";

// Site owner only. The one place that shows who added a resource and from
// which course.
export default async function ModerationPage() {
  const session = await requireSession();
  if (!(await isSiteOwner(session))) redirect("/resources");

  const [reported, types, tags] = await Promise.all([
    prisma.resource.findMany({
      where: { reports: { some: { resolvedAt: null } } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        title: true,
        hiddenAt: true,
        createdByAdmin: { select: { gender: true, course: { select: { name: true } } } },
        createdByTeacher: { select: { name: true, course: { select: { name: true } } } },
        reports: { where: { resolvedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, reason: true, createdAt: true } },
      },
    }),
    prisma.resourceType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, _count: { select: { resources: true } } },
    }),
    prisma.tag.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { resources: true } } },
    }),
  ]);

  return (
    <div>
      <div className={styles.head}>
        <div className={styles.titleBlock}>
          <h1>إدارة بنك الوسائل</h1>
          <p>تظهر هذه الصفحة لمالك الموقع فقط.</p>
        </div>
        <Link href="/resources" className={styles.secondaryBtn}>
          → العودة إلى البنك
        </Link>
      </div>
      <Moderation
        reported={reported.map((r) => ({
          id: r.id,
          url: r.url,
          host: urlHost(r.url),
          title: r.title,
          hidden: r.hiddenAt !== null,
          creator: creatorLabel(r),
          reports: r.reports.map((x) => ({ id: x.id, reason: x.reason, date: x.createdAt.toISOString().slice(0, 10) })),
        }))}
        types={types.map((t) => ({ id: t.id, name: t.name, count: t._count.resources }))}
        tags={tags.map((t) => ({ id: t.id, name: t.name, count: t._count.resources }))}
      />
    </div>
  );
}
