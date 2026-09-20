"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./detail.module.css";
import { calculatePageRange, classifyRecitation, nextExpectedEntry, type FurthestPosition } from "@/lib/recitation/logic";
import { AYAH_COUNT, SURAHS, SURAH_NAME } from "@/lib/quran-data";
import { saveRecitationAction, setAttendanceAction, togglePointAction } from "./actions";

type Quality = "EXCELLENT" | "GOOD" | "NEEDS_REPEAT";
type Mode = "IN_PERSON" | "ONLINE";
type Attendance = "IN" | "OUT" | "PENDING";

interface PointsActivity {
  id: string;
  name: string;
  value: number;
  type: "ADD" | "SUBTRACT";
  done: boolean;
}

interface HistoryEntry {
  id: string;
  date: string;
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  quality: Quality;
  mode: Mode;
  teacherName: string;
  notes: string | null;
  reason: string | null;
}

const QUALITY_LABEL: Record<Quality, string> = {
  EXCELLENT: "متقن (بدون أخطاء)",
  GOOD: "جيد",
  NEEDS_REPEAT: "يحتاج إعادة",
};
const QUALITY_BADGE: Record<Quality, string> = { EXCELLENT: "qGood", GOOD: "qMid", NEEDS_REPEAT: "qLow" };

export function DetailView({
  student,
  plan,
  furthest,
  cumPages,
  cumPoints,
  onlineCount,
  todayPoints: initialTodayPoints,
  totalPages,
  onlineRecitationEnabled,
  pointsActivities,
  history,
}: {
  student: { id: string; name: string; age: number; attendance: Attendance };
  plan: number[];
  furthest: FurthestPosition | null;
  cumPages: number;
  cumPoints: number;
  onlineCount: number;
  todayPoints: number;
  totalPages: number;
  onlineRecitationEnabled: boolean;
  pointsActivities: PointsActivity[];
  history: HistoryEntry[];
}) {
  const router = useRouter();
  const [attendance, setAttendanceState] = useState(student.attendance);
  const [attendancePending, startAttendanceTransition] = useTransition();

  const initialEntry = nextExpectedEntry(plan, furthest);
  const [surahNumber, setSurahNumber] = useState(initialEntry.surahNumber);
  const [fromAyah, setFromAyah] = useState(initialEntry.fromAyah);
  const [toAyah, setToAyah] = useState(initialEntry.toAyah);
  const [quality, setQuality] = useState<Quality>("EXCELLENT");
  const [mode, setMode] = useState<Mode>("IN_PERSON");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savePending, startSaveTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const [pointsState, setPointsState] = useState(pointsActivities);
  const [todayPoints, setTodayPoints] = useState(initialTodayPoints);
  const [, startPointsTransition] = useTransition();

  const classification = useMemo(
    () => classifyRecitation(plan, furthest, surahNumber, fromAyah),
    [plan, furthest, surahNumber, fromAyah],
  );
  const pageResult = useMemo(() => calculatePageRange(surahNumber, fromAyah, toAyah), [surahNumber, fromAyah, toAyah]);

  const reasonFilled = reason.trim().length > 0;
  const hasRangeError = "error" in pageResult;
  const saveDisabled = hasRangeError || (classification.requiresReason && !reasonFilled) || savePending;

  function toggleAttendance(next: "IN" | "OUT") {
    setAttendanceState(next);
    startAttendanceTransition(async () => {
      await setAttendanceAction(student.id, next);
      router.refresh();
    });
  }

  function togglePoint(activity: PointsActivity) {
    const delta = activity.type === "ADD" ? activity.value : -activity.value;
    setPointsState((prev) => prev.map((a) => (a.id === activity.id ? { ...a, done: !a.done } : a)));
    setTodayPoints((prev) => prev + (activity.done ? -delta : delta));
    startPointsTransition(async () => {
      await togglePointAction(student.id, activity.id);
      router.refresh();
    });
  }

  function save() {
    setSaveError(null);
    startSaveTransition(async () => {
      const result = await saveRecitationAction({
        studentId: student.id,
        surahNumber,
        fromAyah,
        toAyah,
        quality,
        mode,
        notes,
        reason,
      });
      if ("error" in result) {
        setSaveError(result.error);
        return;
      }
      setNotes("");
      setReason("");
      router.refresh();

      // advance the form to the next natural entry, unless this was a
      // review of already-covered material (EDIT), where staying put lets
      // the teacher keep adjusting
      if (classification.situation !== "EDIT") {
        const next = nextExpectedEntry(plan, { surahNumber, ayah: toAyah });
        setSurahNumber(next.surahNumber);
        setFromAyah(next.fromAyah);
        setToAyah(next.toAyah);
      }

      setToast(
        classification.situation === "SURAH_GAP" || classification.situation === "AYAH_GAP"
          ? "تم الحفظ مع تسجيل ملاحظة الفجوة ✓"
          : "تم حفظ التسميع ✓",
      );
      setTimeout(() => setToast(null), 2200);
    });
  }

  const ayahCount = AYAH_COUNT[surahNumber];

  return (
    <div>
      <Link href="/students" className={styles.backBtn}>
        → رجوع لقائمة الطالبات
      </Link>

      <div className={styles.girlCard}>
        <div className={styles.girlId}>
          <div className={styles.avatarLg}>{student.name.charAt(0)}</div>
          <div>
            <div className={styles.girlName}>{student.name}</div>
            <div className={styles.girlMeta}>{student.age} سنوات</div>
          </div>
        </div>
        <div className={styles.attendanceToggle}>
          <button
            className={attendance === "IN" ? styles.activeIn : ""}
            onClick={() => toggleAttendance("IN")}
            disabled={attendancePending}
            type="button"
          >
            حاضرة ✓
          </button>
          <button
            className={attendance === "OUT" ? styles.activeOut : ""}
            onClick={() => toggleAttendance("OUT")}
            disabled={attendancePending}
            type="button"
          >
            غائبة
          </button>
        </div>
      </div>

      <div className={styles.lastPos}>
        <div className={styles.icon}>📖</div>
        <div>
          <div className={styles.label}>آخر ما وصلت إليه (حسب الخطة)</div>
          <div className={styles.value}>
            {furthest ? `${SURAH_NAME[furthest.surahNumber]} — الآية ${furthest.ayah} من ${AYAH_COUNT[furthest.surahNumber]}` : "لم تبدأ بعد"}
          </div>
          <div className={styles.sub}>
            {cumPages} صفحة تراكميًا · {onlineCount} تسميع أونلاين
          </div>
        </div>
      </div>

      <div className={styles.secTitle}>
        <span className={styles.dot} /> تسجيل تسميع جديد
      </div>
      <div className={styles.card}>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="surahSel">السورة</label>
            <select
              id="surahSel"
              value={surahNumber}
              onChange={(e) => {
                const n = Number(e.target.value);
                setSurahNumber(n);
                setFromAyah(1);
                setToAyah(Math.min(15, AYAH_COUNT[n]));
              }}
            >
              {SURAHS.map((s) => (
                <option key={s.number} value={s.number}>
                  {s.number}. {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="fromAyah">من آية</label>
            <input
              id="fromAyah"
              type="number"
              min={1}
              value={fromAyah}
              onChange={(e) => setFromAyah(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="toAyah">إلى آية</label>
            <input
              id="toAyah"
              type="number"
              min={1}
              value={toAyah}
              onChange={(e) => setToAyah(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="quality">مستوى التسميع</label>
            <select id="quality" value={quality} onChange={(e) => setQuality(e.target.value as Quality)}>
              <option value="EXCELLENT">متقن (بدون أخطاء)</option>
              <option value="GOOD">جيد</option>
              <option value="NEEDS_REPEAT">يحتاج إعادة</option>
            </select>
          </div>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label>طريقة التسميع</label>
            <div className={styles.attendanceToggle} style={{ width: "100%" }}>
              <button
                type="button"
                className={mode === "IN_PERSON" ? styles.activeIn : ""}
                onClick={() => setMode("IN_PERSON")}
                style={{ flex: 1 }}
              >
                حضوري
              </button>
              <button
                type="button"
                className={mode === "ONLINE" ? styles.activeIn : ""}
                onClick={() => setMode("ONLINE")}
                disabled={!onlineRecitationEnabled}
                style={{ flex: 1 }}
                title={onlineRecitationEnabled ? undefined : "التسميع الأونلاين غير مفعّل في هذه الدورة"}
              >
                أونلاين
              </button>
            </div>
          </div>
          <div className={styles.field} style={{ flex: 2 }}>
            <label htmlFor="notesField">ملاحظات (اختياري)</label>
            <input
              id="notesField"
              type="text"
              placeholder="أي ملاحظة إضافية عن هذا التسميع..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className={`${styles.modeBadge} ${styles[classification.badgeVariant]}`}>{classification.badgeText}</div>

        {classification.warningMessage && (
          <div className={styles.gapWarning}>
            ⚠️ <div>{classification.warningMessage}</div>
          </div>
        )}

        {classification.requiresReason && (
          <div className={styles.reasonBox}>
            <label htmlFor="reasonText">سبب هذا التسجيل (إلزامي)</label>
            <textarea
              id="reasonText"
              placeholder="مثال: تمت مراجعة هذه السورة بناءً على طلب المعلمة..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        {saveError && <div className={styles.err}>{saveError}</div>}
        {!saveError && hasRangeError && (
          <div className={styles.err}>{(pageResult as { error: string }).error}</div>
        )}

        <div className={styles.liveCalc}>
          <div>
            <div className={styles.lcLabel}>صفحات هذه الجلسة (دقيق)</div>
            <div className={styles.lcVal}>{hasRangeError ? "—" : `${pageResult.totalPages} صفحة`}</div>
          </div>
          <div className={styles.lcSub}>
            {!hasRangeError &&
              `صفحة ${pageResult.minPage}${pageResult.maxPage > pageResult.minPage ? ` إلى ${pageResult.maxPage}` : ""} — سورة ${SURAH_NAME[surahNumber]}`}
          </div>
        </div>

        <button className={styles.saveBtn} onClick={save} disabled={saveDisabled} type="button">
          {savePending ? "جارٍ الحفظ..." : "حفظ التسميع"}
        </button>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>
          {ayahCount ? `تحتوي السورة على ${ayahCount} آية` : ""}
        </div>
      </div>

      <div className={styles.secTitle}>
        <span className={styles.dot} /> النقاط اليوم
      </div>
      <div className={styles.card}>
        <div className={styles.pointsGrid}>
          {pointsState.map((a) => (
            <div
              key={a.id}
              className={`${styles.pointBtn} ${a.done ? styles.done : ""} ${a.type === "SUBTRACT" ? styles.subtractType : ""}`}
              onClick={() => togglePoint(a)}
            >
              {a.name}
              <span className={styles.val}>
                {a.type === "ADD" ? "+" : "−"}
                {a.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.secTitle}>
        <span className={styles.dot} /> الإنجاز
      </div>
      <div className={styles.counters}>
        <div className={styles.counter}>
          <div className={styles.num}>{todayPoints}</div>
          <div className={styles.lbl}>نقاط اليوم</div>
        </div>
        <div className={`${styles.counter} ${styles.gold}`}>
          <div className={styles.num}>{cumPoints}</div>
          <div className={styles.lbl}>نقاط الدورة (تراكمي)</div>
        </div>
        <div className={`${styles.counter} ${styles.sage}`}>
          <div className={styles.num}>{Math.round((cumPages / totalPages) * 1000) / 10}٪</div>
          <div className={styles.lbl}>من إنجاز القرآن كامل ({totalPages} صفحة)</div>
        </div>
      </div>

      <div className={styles.secTitle}>
        <span className={styles.dot} /> سجل التسميع
      </div>
      <div className={styles.card}>
        {history.length === 0 ? (
          <div className={styles.logEmpty}>لا يوجد تسميع مسجّل بعد لهذه الطالبة</div>
        ) : (
          history.map((e) => (
            <div className={styles.logRow} key={e.id}>
              <div className={styles.logDate}>{e.date}</div>
              <div className={styles.logBody}>
                <div className={styles.logTitle}>
                  {SURAH_NAME[e.surahNumber]} — آية {e.fromAyah} إلى {e.toAyah}
                </div>
                <div className={styles.logMeta}>
                  <span className={`${styles.logBadge} ${styles[QUALITY_BADGE[e.quality]]}`}>
                    {QUALITY_LABEL[e.quality]}
                  </span>
                  <span className={`${styles.logBadge} ${styles.mode}`}>
                    {e.mode === "ONLINE" ? "أونلاين" : "حضوري"}
                  </span>
                  <span className={styles.logTeacher}>بواسطة {e.teacherName}</span>
                </div>
                {e.reason && <div className={styles.logReason}>سبب: {e.reason}</div>}
                {e.notes && <div className={styles.logNotes}>&quot;{e.notes}&quot;</div>}
              </div>
            </div>
          ))
        )}
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--sage-deep)",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
