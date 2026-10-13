import styles from "./goal.module.css";
import { ayatLabel, daysLeftLabel, pagesTotalLabel, quarterPagesLabel, type GoalStatus, type GoalView } from "@/lib/goals/goal";

// Her memorization goal, compact, under her position: on the staff student
// page, the student portal, the parent view and «صفحتي» (lib/goals/goal.ts).
// Renders nothing without a goal.

const STATUS_LABEL: Record<GoalStatus, { m: string; f: string }> = {
  ON_TRACK: { m: "على المسار", f: "على المسار" },
  BEHIND: { m: "متأخر", f: "متأخرة" },
  AHEAD: { m: "متقدّم", f: "متقدّمة" },
};

export function GoalLine({
  goal,
  feminine,
  invalidHint = null,
}: {
  goal: GoalView | null;
  // the status in the feminine («متأخرة»)
  feminine: boolean;
  // shown when the target is no longer in her plan; null hides the goal then
  invalidHint?: string | null;
}) {
  if (!goal || (goal.state === "INVALID" && !invalidHint)) return null;
  return (
    <div className={styles.goalLine}>
      🎯 الهدف: <b>{goal.label}</b> · الموعد {goal.deadline}
      <div>
        {goal.state === "ACTIVE" && (
          <>
            <span className={styles.daily}>
              المطلوب يوميًا: <b>{quarterPagesLabel(goal.dailyQuarter)}</b> ≈ {ayatLabel(goal.dailyAyat)}
            </span>
            <span className={`${styles.status} ${styles[goal.status]}`}>{STATUS_LABEL[goal.status][feminine ? "f" : "m"]}</span>
            <div>
              المتبقي: {pagesTotalLabel(goal.remainingPages)} {daysLeftLabel(goal.daysLeft)}
              {goal.todayDone ? " · ✓ أُنجز مطلوب اليوم" : goal.doneToday > 0 ? ` · اليوم: ${pagesTotalLabel(goal.doneToday)}` : ""}
            </div>
          </>
        )}
        {goal.state === "REACHED" && <span className={styles.reached}>تم بلوغ الهدف ✓</span>}
        {goal.state === "EXPIRED" && (
          <span className={styles.alert}>انتهى الموعد قبل بلوغ الهدف — المتبقي: {pagesTotalLabel(goal.remainingPages)}</span>
        )}
        {goal.state === "INVALID" && <span className={styles.alert}>{invalidHint}</span>}
      </div>
    </div>
  );
}
