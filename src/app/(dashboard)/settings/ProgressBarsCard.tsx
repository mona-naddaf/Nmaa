"use client";

import { useTransition } from "react";
import styles from "./settings.module.css";
import { setProgressBarAction, type ProgressBarField } from "./actions";

const BARS: { field: ProgressBarField; title: string; desc: string }[] = [
  {
    field: "showSurahProgress",
    title: "التقدّم حتى نهاية السورة الحالية",
    desc: "الآية التي وصل إليها الطالب من مجموع آيات السورة التي يحفظ فيها الآن.",
  },
  {
    field: "showJuzProgress",
    title: "التقدّم حتى نهاية الجزء الحالي",
    desc: "الصفحات المحفوظة من الجزء الذي يحفظ فيه الطالب الآن، من مجموع صفحات هذا الجزء.",
  },
  {
    field: "showQuranProgress",
    title: "التقدّم نحو ختم القرآن كامل",
    desc: "الصفحات المحفوظة (دون احتساب التكرار) من أصل ٦٠٤ صفحات.",
  },
  {
    field: "showPlanProgress",
    title: "التقدّم نحو إتمام الخطة الحالية",
    desc: "الصفحات المحفوظة من سور خطة الطالب، من مجموع صفحات هذه السور.",
  },
];

export function ProgressBarsCard({ enabled }: { enabled: Record<ProgressBarField, boolean> }) {
  const [, startTransition] = useTransition();

  return (
    <>
      {BARS.map((bar) => {
        const on = enabled[bar.field];
        return (
          <div key={bar.field} className={styles.settingRow}>
            <div className={styles.settingText}>
              <div className={styles.settingTitle}>{bar.title}</div>
              <div className={styles.settingDesc}>{bar.desc}</div>
            </div>
            <div className={styles.optionPills}>
              <div
                className={`${styles.optionPill} ${on ? styles.sel : ""}`}
                onClick={() => startTransition(() => setProgressBarAction(bar.field, true))}
              >
                مفعّل
              </div>
              <div
                className={`${styles.optionPill} ${!on ? styles.sel : ""}`}
                onClick={() => startTransition(() => setProgressBarAction(bar.field, false))}
              >
                غير مفعّل
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
