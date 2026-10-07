import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { isSiteOwner } from "@/lib/resources/access";
import styles from "../resources/bank.module.css";
import { TemplateModeration } from "./TemplateModeration";
import { rafiqEnabled } from "@/lib/rafiq/enabled";

// Site owner only: the tracker template bank of «رفيق الحفظ». Unlike the
// resource bank's moderation, it never shows who published or reported a
// template — Rafiq accounts are private, even from the owner.
export default async function TrackerTemplatesPage() {
  const session = await requireSession();
  if (!rafiqEnabled() || !(await isSiteOwner(session))) redirect("/resources");

  const templates = await prisma.trackerTemplate.findMany({
    orderBy: [{ suggested: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      suggested: true,
      hiddenAt: true,
      useCount: true,
      createdAt: true,
      items: { orderBy: { sortOrder: "asc" }, select: { title: true, value: true, days: true } },
      reports: { where: { resolvedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, reason: true, createdAt: true } },
    },
  });

  return (
    <div>
      <div className={styles.head}>
        <div className={styles.titleBlock}>
          <h1>إدارة بنك جداول المتابعة</h1>
          <p>جداول «رفيق الحفظ». تظهر هذه الصفحة لمالك الموقع فقط، ولا يظهر فيها من نشر الجدول أو أبلغ عنه.</p>
        </div>
        <Link href="/resources/moderation" className={styles.secondaryBtn}>
          → إدارة بنك الوسائل
        </Link>
      </div>
      <TemplateModeration
        templates={templates.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          suggested: t.suggested,
          hidden: t.hiddenAt !== null,
          useCount: t.useCount,
          date: t.createdAt.toISOString().slice(0, 10),
          items: t.items,
          reports: t.reports.map((r) => ({ id: r.id, reason: r.reason, date: r.createdAt.toISOString().slice(0, 10) })),
        }))}
      />
    </div>
  );
}
