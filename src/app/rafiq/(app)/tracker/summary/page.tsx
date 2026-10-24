import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import hl from "@/components/home-log/home-log.module.css";
import { RafiqSummary } from "./RafiqSummary";
import { targetAttr } from "@/lib/guide/help/targets";
import { guideEnabled } from "@/lib/guide/enabled";

// «المحصّلات» of her tracker, on her own days (her browser's time zone, so
// the first load happens in the browser). Only while she has them on.
export default async function RafiqSummaryPage() {
  const user = await requireRafiqUser();
  const { summaryEnabled } = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: user.id }, select: { summaryEnabled: true } });
  if (!summaryEnabled) redirect("/rafiq/tracker");
  return (
    <div>
      <div className={hl.sectionTitle}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>📊 المحصّلات</span>
        <Link href="/rafiq/tracker" className={hl.linkBtn} {...targetAttr("summary.back", guideEnabled())}>
          → جدول المتابعة
        </Link>
      </div>
      <RafiqSummary g={user.gender === "FEMALE" ? "GIRLS" : "BOYS"} />
    </div>
  );
}
