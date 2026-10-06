import Link from "next/link";
import styles from "./home-log.module.css";
import { TargetProgress, segmentTitle } from "./TargetProgress";
import type { HomeSegmentView } from "@/lib/home-log/data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";

/**
 * One segment in a list: a link to practise it while active.
 * recitedLabel: shown when a recorded session covered it (finishedBy TEACHER_RECITED).
 */
export function SegmentCard({
  s,
  g,
  href,
  recitedLabel = "سُمِّع للمعلم ✓",
}: {
  s: HomeSegmentView;
  g: GroupGender;
  href: string;
  recitedLabel?: string;
}) {
  const active = s.finishedAt === null;
  const body = (
    <>
      <div className={styles.segTitle}>
        {segmentTitle(s)}
        {s.assignmentId && <span className={`${styles.badge} ${styles.teacher}`}>📌 واجب</span>}
        {s.targetsMet && <span className={styles.badge}>🎉 {pickByGroup(g, { m: "أنجزتَ الأهداف", f: "أنجزتِ الأهداف" })}</span>}
        {s.finishedBy === "TEACHER_RECITED" && <span className={`${styles.badge} ${styles.teacher}`}>{recitedLabel}</span>}
      </div>
      <div className={styles.segMeta}>
        بدأ {s.createdAt}
        {s.finishedAt && ` · انتهى ${s.finishedAt}`}
      </div>
      <TargetProgress counts={s.counts} targets={s.targets} />
    </>
  );
  return active ? (
    <Link href={href} className={`${styles.segCard} ${s.targetsMet ? styles.done : ""}`}>
      {body}
    </Link>
  ) : (
    <div className={`${styles.segCard} ${styles.done}`}>{body}</div>
  );
}
