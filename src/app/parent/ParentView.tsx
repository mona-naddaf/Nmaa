"use client";

import { useMemo } from "react";
import shell from "@/app/(dashboard)/shell.module.css";
import styles from "@/app/(dashboard)/students/[id]/detail.module.css";
import { DateRangeFilter } from "@/components/date-range/DateRangeFilter";
import { useDateRange } from "@/components/date-range/useDateRange";
import { AYAH_COUNT, SURAH_NAME } from "@/lib/quran-data";
import { pickByGroup, presentWord, absentWord } from "@/lib/text/gender";
import type { ParentViewData } from "@/lib/parent/data";
import { parentLogoutAction } from "./actions";

const QUALITY_LABEL = { EXCELLENT: "متقن (بدون أخطاء)", GOOD: "جيد", NEEDS_REPEAT: "يحتاج إعادة" } as const;
const QUALITY_BADGE = { EXCELLENT: "qGood", GOOD: "qMid", NEEDS_REPEAT: "qLow" } as const;
const SESSION_TYPE_LABEL = { NEW: "حفظ جديد", REVIEW: "مراجعة", LINK: "ربط" } as const;

// Read-only by construction: no inputs besides the date filter, and the only
// server action reachable from here is logout.
export function ParentView({ data }: { data: ParentViewData }) {
  const g = data.groupGender;

  const range = useDateRange(
    useMemo(
      () => [
        ...data.history.filter((h) => h.source === "LOGGED").map((h) => h.date),
        ...data.attendance.map((a) => a.date),
        ...data.points.map((p) => p.date),
      ],
      [data],
    ),
  );
  const { matches } = range;

  const view = useMemo(() => {
    const history = data.history.filter((h) => matches(h.date));
    // prior-to-joining memorization isn't achievement within this course,
    // same rule as the leaderboard
    const pages = history.filter((h) => h.source === "LOGGED").reduce((sum, h) => sum + h.pages, 0);
    const attendance = data.attendance.filter((a) => matches(a.date));
    const points = data.points.filter((p) => matches(p.date));

    const byActivity = new Map<string, number>();
    for (const p of points) byActivity.set(p.activityName, (byActivity.get(p.activityName) ?? 0) + p.value);

    return {
      history,
      pages: Math.round(pages * 10) / 10,
      present: attendance.filter((a) => a.status === "IN").length,
      absent: attendance.filter((a) => a.status === "OUT").length,
      points: points.reduce((sum, p) => sum + p.value, 0),
      byActivity: [...byActivity.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [data, matches]);

  const hasAnyData = range.lastDate !== undefined;

  return (
    <div className={shell.shell}>
      <div className={shell.bar}>
        <div className={shell.brand}>نماء 🌱</div>
        <div className={shell.who}>
          <span>
            متابعة وليّ الأمر · <b>{data.courseName}</b>
          </span>
          <form action={parentLogoutAction}>
            <button className={shell.logoutBtn} type="submit">
              تسجيل خروج
            </button>
          </form>
        </div>
      </div>

      <div className={shell.content}>
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
            <div className={styles.label}>
              آخر ما {pickByGroup(g, { m: "وصل", f: "وصلت" })} إليه (حسب الخطة)
            </div>
            <div className={styles.value}>
              {data.furthest
                ? `${SURAH_NAME[data.furthest.surahNumber]} — الآية ${data.furthest.ayah} من ${AYAH_COUNT[data.furthest.surahNumber]}`
                : `لم ${pickByGroup(g, { m: "يبدأ", f: "تبدأ" })} بعد`}
            </div>
            <div className={styles.sub}>{data.quranPercent}٪ من إنجاز القرآن كامل</div>
          </div>
        </div>

        {hasAnyData ? (
          <>
            <DateRangeFilter range={range} />
            {range.tab === "last" && (
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: -8, marginBottom: 14 }}>
                آخر يوم مسجّل: {range.lastDate}
              </div>
            )}

            <div className={styles.counters}>
              <div className={`${styles.counter} ${styles.sage}`}>
                <div className={styles.num}>{view.pages}</div>
                <div className={styles.lbl}>صفحة</div>
              </div>
              <div className={styles.counter}>
                <div className={styles.num}>
                  {view.present} / {view.present + view.absent}
                </div>
                <div className={styles.lbl}>
                  أيام {presentWord(g)} · {view.absent} {absentWord(g)}
                </div>
              </div>
              <div className={`${styles.counter} ${styles.gold}`}>
                <div className={styles.num}>{view.points}</div>
                <div className={styles.lbl}>نقطة</div>
              </div>
            </div>

            {view.byActivity.length > 0 && (
              <>
                <div className={styles.secTitle}>
                  <span className={styles.dot} /> تفاصيل النقاط
                </div>
                <div className={styles.card}>
                  {view.byActivity.map(([name, value]) => (
                    <div className={styles.logRow} key={name}>
                      <div className={styles.logBody}>
                        <div className={styles.logTitle}>{name}</div>
                      </div>
                      <div className={styles.logDate}>
                        {value > 0 ? `+${value}` : value}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className={styles.secTitle}>
              <span className={styles.dot} /> سجل التسميع
            </div>
            <div className={styles.card}>
              {view.history.length === 0 ? (
                <div className={styles.logEmpty}>لا يوجد تسميع مسجّل ضمن هذه الفترة</div>
              ) : (
                view.history.map((e) => (
                  <div className={styles.logRow} key={e.id}>
                    <div className={styles.logDate}>{e.date}</div>
                    <div className={styles.logBody}>
                      <div className={styles.logTitle}>
                        {SURAH_NAME[e.surahNumber]} — آية {e.fromAyah} إلى {e.toAyah}
                      </div>
                      <div className={styles.logMeta}>
                        {e.source === "PRIOR" ? (
                          <span className={`${styles.logBadge} ${styles.mode}`}>📚 حفظ سابق قبل الانضمام</span>
                        ) : (
                          e.quality && (
                            <span className={`${styles.logBadge} ${styles[QUALITY_BADGE[e.quality]]}`}>
                              {QUALITY_LABEL[e.quality]}
                            </span>
                          )
                        )}
                        {e.type !== "NEW" && (
                          <span className={`${styles.logBadge} ${styles.typeBadge}`}>↺ {SESSION_TYPE_LABEL[e.type]}</span>
                        )}
                        <span className={styles.logTeacher}>بواسطة {e.teacherName}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className={styles.card}>
            <div className={styles.logEmpty}>لا توجد بيانات مسجّلة بعد</div>
          </div>
        )}
      </div>
    </div>
  );
}
