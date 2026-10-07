"use client";

import { useMemo } from "react";
import styles from "@/app/(dashboard)/students/[id]/detail.module.css";
import { DateRangeFilter } from "@/components/date-range/DateRangeFilter";
import { useDateRange } from "@/components/date-range/useDateRange";
import { MistakesList } from "@/components/mistakes/MistakesList";
import { AYAH_COUNT, SURAH_NAME } from "@/lib/quran-data";
import { pickByGroup } from "@/lib/text/gender";
import type { StudentHomeData } from "@/lib/student-portal/data";

// Read-only by construction (phase 1): no inputs besides the points date
// filter. Wording follows the student's group (طالب/طالبة).
export function StudentHome({ data }: { data: StudentHomeData }) {
  const g = data.groupGender;
  const p = (m: string, f: string) => pickByGroup(g, { m, f });

  // the same points summary as the parent view
  const range = useDateRange(useMemo(() => data.points.map((x) => x.date), [data]));
  const { matches } = range;
  const points = useMemo(() => {
    const inRange = data.points.filter((x) => matches(x.date));
    const byActivity = new Map<string, number>();
    for (const x of inRange) byActivity.set(x.activityName, (byActivity.get(x.activityName) ?? 0) + x.value);
    return {
      total: inRange.reduce((sum, x) => sum + x.value, 0),
      byActivity: [...byActivity.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [data, matches]);

  return (
    <div>
      <div className={styles.girlCard}>
        <div className={styles.girlId}>
          <div className={styles.avatarLg}>{data.studentName.charAt(0)}</div>
          <div>
            <div className={styles.girlName}>{data.studentName}</div>
            <div className={styles.girlMeta}>مجموعة {data.groupName}</div>
          </div>
        </div>
      </div>

      <div className={styles.lastPos}>
        <div className={styles.icon}>📖</div>
        <div>
          <div className={styles.label}>آخر ما {p("وصلتَ", "وصلتِ")} إليه (حسب الخطة)</div>
          <div className={styles.value}>
            {data.position
              ? `${SURAH_NAME[data.position.surahNumber]} — الآية ${data.position.ayah} من ${AYAH_COUNT[data.position.surahNumber]}`
              : `لم ${p("تبدأ", "تبدئي")} بعد`}
          </div>
          <div className={styles.sub}>{data.quranPercent}٪ من إنجاز القرآن كامل</div>
        </div>
      </div>

      {data.progressBars.length > 0 && (
        <div className={styles.progressList}>
          {data.progressBars.map((bar) => (
            <div key={bar.key} className={styles.progressItem}>
              <div className={styles.progressHead}>
                <span className={styles.progressLabel}>{bar.label}</span>
                <span className={styles.progressDetail}>
                  {bar.detail} · {bar.percent}٪
                </span>
              </div>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-label={bar.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={bar.percent}
              >
                <div className={styles.progressFill} style={{ width: `${bar.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {data.mistakes.length > 0 && (
        <>
          <div className={styles.secTitle}>
            <span className={styles.dot} /> 🔖 كلمات {p("تتدرّب", "تتدرّبين")} عليها ({data.mistakes.length})
          </div>
          <div className={styles.card}>
            <MistakesList mistakes={data.mistakes} subject={g} />
          </div>
        </>
      )}

      <div className={styles.secTitle}>
        <span className={styles.dot} /> {p("نقاطك", "نقاطكِ")}
      </div>
      {range.lastDate === undefined ? (
        <div className={styles.card}>
          <div className={styles.logEmpty}>لا توجد نقاط مسجّلة بعد</div>
        </div>
      ) : (
        <>
          <DateRangeFilter range={range} />
          {range.tab === "last" && (
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: -8, marginBottom: 14 }}>
              آخر يوم مسجّل: {range.lastDate}
            </div>
          )}
          <div className={styles.counters}>
            <div className={`${styles.counter} ${styles.gold}`}>
              <div className={styles.num}>{points.total}</div>
              <div className={styles.lbl}>نقطة</div>
            </div>
          </div>
          {points.byActivity.length > 0 && (
            <div className={styles.card}>
              {points.byActivity.map(([name, value]) => (
                <div className={styles.logRow} key={name}>
                  <div className={styles.logBody}>
                    <div className={styles.logTitle}>{name}</div>
                  </div>
                  <div className={styles.logDate}>{value > 0 ? `+${value}` : value}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
