"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./detail.module.css";
import type { PlanPosition, Reach, SessionType } from "@/lib/recitation/logic";
import { AYAH_COUNT, SURAH_NAME } from "@/lib/quran-data";
import { todayISO } from "@/lib/attendance";
import type { ProgressBar } from "@/lib/students/progress";
import type { OverdueSurah } from "@/lib/students/review";
import { addBonusPointAction, resolveMistakeAction, saveRecitationAction, setAttendanceAction, togglePointAction } from "./actions";
import { BONUS_NOTE_MAX_LENGTH, BONUS_POINTS_LABEL } from "@/lib/points/bonus";
import { MistakesList } from "@/components/mistakes/MistakesList";
import { Collapsible } from "@/components/collapsible/Collapsible";
import { SESSIONS, SURAHS_COUNT, WORDS, countLabel } from "@/lib/text/count";
import { WordFlagger } from "@/components/mistakes/WordFlagger";
import {
  EntryStatus,
  PageCalc,
  ReasonBox,
  SESSION_TYPE_LABEL,
  SessionTypePills,
  SurahRangeFields,
  recitationStyles as rs,
  useRecitationEntry,
} from "@/components/recitation/RecitationEntry";
import type { ActiveMistake } from "@/lib/students/mistake-types";
import { STREAK_MODE_LABEL, streakText, type StreakMode } from "@/lib/students/streak";
import {
  presentWord,
  absentWord,
  studentsNounDef,
  thisDemonstrative,
  pickByPerson,
  pickByGroup,
  type GroupGender,
  type PersonGender,
} from "@/lib/text/gender";

type Quality = "EXCELLENT" | "GOOD" | "NEEDS_REPEAT";
type Mode = "IN_PERSON" | "ONLINE";
type Attendance = "IN" | "OUT" | "PENDING";
type Source = "LOGGED" | "PRIOR";

interface PointsActivity {
  id: string;
  name: string;
  value: number;
  type: "ADD" | "SUBTRACT";
}

interface PointsLogEntry {
  // null for a bonus point
  activityId: string | null;
  date: string;
  value: number;
  bonus?: { id: string; note: string; teacherName: string };
}

interface HistoryEntry {
  id: string;
  date: string;
  source: Source;
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  quality: Quality | null;
  mode: Mode | null;
  type: SessionType;
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
  groupGender,
  viewerGender,
  plan,
  position,
  reach,
  cumPages,
  cumPoints,
  streak,
  onlineCount,
  coveredPages,
  totalPages,
  progressBars,
  memorizedRanges,
  overdueSurahs,
  mistakes,
  reviewReminderDays,
  onlineRecitationEnabled,
  pointsActivities,
  pointsLogs: initialPointsLogs,
  history,
  headerActions,
  headerBadge,
  infoSection,
  expandAll = false,
}: {
  student: { id: string; name: string; age: number; grade: string | null; attendance: Attendance };
  groupGender: GroupGender;
  viewerGender: PersonGender;
  plan: number[];
  position: PlanPosition | null;
  reach: Reach;
  cumPages: number;
  cumPoints: number;
  // null when the course has streaks off
  streak: { mode: StreakMode; weeks: number } | null;
  onlineCount: number;
  coveredPages: number;
  totalPages: number;
  progressBars: ProgressBar[];
  memorizedRanges: Record<number, [number, number][]>;
  overdueSurahs: OverdueSurah[];
  mistakes: ActiveMistake[];
  reviewReminderDays: number | null;
  onlineRecitationEnabled: boolean;
  pointsActivities: PointsActivity[];
  pointsLogs: PointsLogEntry[];
  history: HistoryEntry[];
  // edit/archive buttons, rendered under the name (null when not allowed)
  headerActions?: React.ReactNode;
  // «معلومات ناقصة», under the name (null when nothing is missing)
  headerBadge?: React.ReactNode;
  // «معلومات إضافية» (a Collapsible), after the review reminders
  infoSection?: React.ReactNode;
  // open every collapsible section (and don't remember anything): the
  // archive's read-only (inert) view, where nothing can be clicked open
  expandAll?: boolean;
}) {
  const router = useRouter();
  const today = todayISO();
  const [attendance, setAttendanceState] = useState(student.attendance);
  const [attendancePending, startAttendanceTransition] = useTransition();

  const entry = useRecitationEntry({ plan, position, reach, memorizedRanges, subject: groupGender });
  const { surahNumber, fromAyah, toAyah, sessionType, classification, pageResult, isNew } = entry;
  const hasRangeError = "error" in pageResult;
  const [quality, setQuality] = useState<Quality>("EXCELLENT");
  const [mode, setMode] = useState<Mode>("IN_PERSON");
  const [notes, setNotes] = useState("");
  const [sessionDate, setSessionDate] = useState(today);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savePending, startSaveTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const [pointsLogs, setPointsLogs] = useState(initialPointsLogs);
  // "+ نقاط إضافية": the note stays after each press so the same reason can
  // be given again straight away
  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusNote, setBonusNote] = useState("");
  const [bonusError, setBonusError] = useState<string | null>(null);
  const [, startPointsTransition] = useTransition();

  const doneForSelectedDate = useMemo(
    () => new Set(pointsLogs.filter((p) => p.date === sessionDate).map((p) => p.activityId)),
    [pointsLogs, sessionDate],
  );
  const pointsForSelectedDate = useMemo(
    () => pointsLogs.filter((p) => p.date === sessionDate).reduce((sum, p) => sum + p.value, 0),
    [pointsLogs, sessionDate],
  );

  const saveDisabled = hasRangeError || (entry.requiresReason && !entry.reasonFilled) || savePending;

  function startReview(surah: number) {
    entry.startReview(surah);
    document.getElementById("recitationForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showError(message: string) {
    setToast(`⚠️ ${message}`);
    setTimeout(() => setToast(null), 3500);
  }

  function toggleAttendance(next: "IN" | "OUT") {
    const previous = attendance;
    setAttendanceState(next);
    startAttendanceTransition(async () => {
      const result = await setAttendanceAction(student.id, next);
      if (result.error) {
        setAttendanceState(previous);
        showError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const bonusForSelectedDate = pointsLogs.filter((p) => p.bonus && p.date === sessionDate);

  // Optimistic, and never blocked while a previous press is in flight: each
  // press is its own request and its own row.
  function addBonusPoint() {
    const note = bonusNote.trim();
    if (!note) return;
    const tempId = `pending-${Date.now()}-${Math.random()}`;
    const date = sessionDate;
    setBonusError(null);
    setPointsLogs((prev) => [...prev, { activityId: null, date, value: 1, bonus: { id: tempId, note, teacherName: "" } }]);
    startPointsTransition(async () => {
      const result = await addBonusPointAction(student.id, date, note);
      setPointsLogs((prev) =>
        "error" in result
          ? prev.filter((p) => p.bonus?.id !== tempId)
          : prev.map((p) => (p.bonus?.id === tempId ? { ...p, bonus: result } : p)),
      );
      if ("error" in result) setBonusError(result.error);
      else router.refresh();
    });
  }

  function togglePoint(activity: PointsActivity) {
    const delta = activity.type === "ADD" ? activity.value : -activity.value;
    const isDone = doneForSelectedDate.has(activity.id);
    const before = pointsLogs;
    setPointsLogs((prev) =>
      isDone
        ? prev.filter((p) => !(p.activityId === activity.id && p.date === sessionDate))
        : [...prev, { activityId: activity.id, date: sessionDate, value: delta }],
    );
    startPointsTransition(async () => {
      const result = await togglePointAction(student.id, activity.id, sessionDate);
      if (result.error) {
        setPointsLogs(before);
        showError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function save() {
    setSaveError(null);
    startSaveTransition(async () => {
      const result = await saveRecitationAction({
        studentId: student.id,
        ...entry.entryInput(),
        quality,
        mode,
        notes,
        sessionDate,
      });
      if ("error" in result) {
        setSaveError(result.error);
        return;
      }
      setNotes("");
      router.refresh();
      entry.afterSave();

      setToast(
        !isNew
          ? `تم حفظ جلسة ال${SESSION_TYPE_LABEL[sessionType]} ✓`
          : classification.situation === "SURAH_GAP" || classification.situation === "AYAH_GAP"
            ? "تم الحفظ مع تسجيل ملاحظة الفجوة ✓"
            : "تم حفظ التسميع ✓",
      );
      setTimeout(() => setToast(null), 2200);
    });
  }

  const ayahCount = AYAH_COUNT[surahNumber];

  // Collapsible sections: open/closed is remembered per device across every
  // student (same keys on every page); the archive's read-only view instead
  // shows them all open, since nothing there can be clicked.
  const section = (key: string) => (expandAll ? { defaultOpen: true } : { persistKey: `student.${key}` });

  // short hints for the collapsed headers
  const mainBar = progressBars.find((b) => b.key === "plan") ?? progressBars.find((b) => b.key === "quran");
  const progressHint = mainBar ? `${mainBar.key === "plan" ? "الخطة" : "القرآن"} ${mainBar.percent}٪` : undefined;
  const logged = history.filter((e) => e.source === "LOGGED");
  const historyHint =
    logged.length === 0 ? (
      "لا يوجد تسميع بعد"
    ) : (
      <>
        {countLabel(logged.length, SESSIONS)} · آخرها <bdi dir="ltr">{logged[0].date}</bdi>
      </>
    );

  return (
    <div>
      <Link href="/students" className={styles.backBtn}>
        → رجوع لقائمة {studentsNounDef(groupGender)}
      </Link>

      <div className={styles.girlCard}>
        <div className={styles.girlId}>
          <div className={styles.avatarLg}>{student.name.charAt(0)}</div>
          <div>
            <div className={styles.girlName}>{student.name}</div>
            <div className={styles.girlMeta}>
              {student.age} سنوات
              {student.grade && ` · ${student.grade.startsWith("الصف") ? student.grade : `الصف ${student.grade}`}`}
            </div>
            {headerBadge}
            {headerActions}
          </div>
        </div>
        <div className={styles.attendanceToggle}>
          <button
            className={attendance === "IN" ? styles.activeIn : ""}
            onClick={() => toggleAttendance("IN")}
            disabled={attendancePending}
            type="button"
          >
            {presentWord(groupGender)} ✓
          </button>
          <button
            className={attendance === "OUT" ? styles.activeOut : ""}
            onClick={() => toggleAttendance("OUT")}
            disabled={attendancePending}
            type="button"
          >
            {absentWord(groupGender)}
          </button>
        </div>
      </div>

      <div className={styles.lastPos}>
        <div className={styles.icon}>📖</div>
        <div>
          <div className={styles.label}>آخر ما وصلت إليه (حسب الخطة)</div>
          <div className={styles.value}>
            {position
              ? `${SURAH_NAME[position.surahNumber]} — الآية ${position.ayah} من ${AYAH_COUNT[position.surahNumber]}`
              : `لم ${pickByGroup(groupGender, { m: "يبدأ", f: "تبدأ" })} بعد`}
          </div>
          <div className={styles.sub}>
            {cumPages} صفحة تراكميًا · {onlineCount} تسميع أونلاين
          </div>
        </div>
      </div>

      {/* Recording a session stays open at the top; every other section
          below starts collapsed (all open on the archive's read-only view). */}
      <div className={styles.secTitle} id="recitationForm">
        <span className={styles.dot} /> تسجيل تسميع جديد
      </div>
      <div className={styles.card}>
        <SessionTypePills entry={entry} />
        <div className={rs.fieldRow}>
          <SurahRangeFields entry={entry} />
          <div className={rs.field}>
            <label htmlFor="quality">مستوى التسميع</label>
            <select id="quality" value={quality} onChange={(e) => setQuality(e.target.value as Quality)}>
              <option value="EXCELLENT">متقن (بدون أخطاء)</option>
              <option value="GOOD">جيد</option>
              <option value="NEEDS_REPEAT">يحتاج إعادة</option>
            </select>
          </div>
        </div>

        <div className={rs.fieldRow}>
          <div className={rs.field}>
            <label htmlFor="sessionDate">تاريخ الجلسة</label>
            <input
              id="sessionDate"
              type="date"
              max={today}
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value || today)}
            />
          </div>
          <div className={rs.field}>
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
          <div className={rs.field} style={{ flex: 2 }}>
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

        {sessionDate !== today && (
          <div className={rs.modeBadge} style={{ background: "rgba(156,148,132,0.28)", color: "var(--sage-deep)" }}>
            ⏱️ جلسة مؤرَّخة بتاريخ سابق ({sessionDate}) — ستُنسب نقاطها إلى هذا التاريخ لا إلى اليوم
          </div>
        )}
        <EntryStatus
          entry={entry}
          positionOf={`موضع ${pickByGroup(groupGender, { m: "الطالب", f: "الطالبة" })}`}
          confirmVerb={pickByPerson(viewerGender, { m: "تأكّد", f: "تأكّدي" })}
        />

        {!hasRangeError && (
          <WordFlagger
            surahNumber={surahNumber}
            fromAyah={fromAyah}
            toAyah={toAyah}
            startCollapsed={pageResult.totalPages > 3}
            flags={entry.wordFlags}
            onChange={entry.setWordFlags}
            subject={groupGender}
          />
        )}

        <ReasonBox
          entry={entry}
          placeholder={`مثال: تمت مراجعة هذه السورة بناءً على طلب ${pickByPerson(viewerGender, { m: "المعلم", f: "المعلمة" })}...`}
        />

        {saveError && <div className={styles.err}>{saveError}</div>}
        {!saveError && hasRangeError && (
          <div className={styles.err}>{(pageResult as { error: string }).error}</div>
        )}

        <PageCalc surahNumber={surahNumber} pageResult={pageResult} />

        <button className={rs.saveBtn} onClick={save} disabled={saveDisabled} type="button">
          {savePending ? "جارٍ الحفظ..." : "حفظ التسميع"}
        </button>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>
          {ayahCount ? `تحتوي السورة على ${ayahCount} آية` : ""}
        </div>
      </div>

      <Collapsible
        title={sessionDate === today ? "النقاط اليوم" : `النقاط ليوم ${sessionDate}`}
        tag={`${pointsForSelectedDate} نقطة`}
        {...section("points")}
      >
        <div className={styles.pointsGrid}>
          {pointsActivities.map((a) => {
            const done = doneForSelectedDate.has(a.id);
            return (
              <div
                key={a.id}
                className={`${styles.pointBtn} ${done ? styles.done : ""} ${a.type === "SUBTRACT" ? styles.subtractType : ""}`}
                onClick={() => togglePoint(a)}
              >
                {a.name}
                <span className={styles.val}>
                  {a.type === "ADD" ? "+" : "−"}
                  {a.value}
                </span>
              </div>
            );
          })}
        </div>

        <div className={styles.bonusBox}>
          {bonusOpen ? (
            <div className={styles.bonusForm}>
              <input
                type="text"
                autoFocus
                maxLength={BONUS_NOTE_MAX_LENGTH}
                placeholder="سبب النقطة الإضافية (إلزامي)..."
                value={bonusNote}
                onChange={(e) => setBonusNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addBonusPoint();
                }}
                aria-label="سبب النقطة الإضافية"
              />
              <button type="button" className={styles.bonusAdd} onClick={addBonusPoint} disabled={!bonusNote.trim()}>
                +1
              </button>
              <button type="button" className={styles.bonusCancel} onClick={() => setBonusOpen(false)}>
                إغلاق
              </button>
            </div>
          ) : (
            <button type="button" className={styles.bonusOpen} onClick={() => setBonusOpen(true)}>
              + {BONUS_POINTS_LABEL}
            </button>
          )}
          {bonusError && <div className={styles.err}>{bonusError}</div>}
          {bonusForSelectedDate.length > 0 && (
            <ul className={styles.bonusList}>
              {bonusForSelectedDate.map((p) => (
                <li key={p.bonus!.id} className={p.bonus!.id.startsWith("pending-") ? styles.bonusPending : undefined}>
                  <span className={styles.bonusPlus}>+1</span>
                  <span className={styles.bonusNote}>{p.bonus!.note}</span>
                  {p.bonus!.teacherName && <span className={styles.bonusBy}>بواسطة {p.bonus!.teacherName}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Collapsible>

      {mistakes.length > 0 && (
        <Collapsible title="🔖 كلمات تحتاج مراجعة" tag={countLabel(mistakes.length, WORDS)} {...section("mistakes")}>
          <MistakesList
            mistakes={mistakes}
            subject={groupGender}
            onResolve={async (m) => {
              const result = await resolveMistakeAction(student.id, m.surahNumber, m.ayah, m.wordPosition);
              if (!("error" in result)) router.refresh();
              return result;
            }}
          />
        </Collapsible>
      )}

      {overdueSurahs.length > 0 && (
        <Collapsible title="🔁 سور تحتاج مراجعة" tag={countLabel(overdueSurahs.length, SURAHS_COUNT)} {...section("review")}>
          <div className={styles.reviewHint} style={{ marginBottom: 8 }}>
            لم تُراجع كاملةً منذ أكثر من {reviewReminderDays} يومًا
          </div>
          {overdueSurahs.map((o) => (
            <button key={o.surahNumber} type="button" className={styles.reviewRow} onClick={() => startReview(o.surahNumber)}>
              <span className={styles.reviewSurah}>{SURAH_NAME[o.surahNumber]}</span>
              <span className={styles.reviewMeta}>
                {/* bdi keeps the YYYY-MM-DD date from being reordered by the RTL sentence around it */}
                {o.neverReviewed ? "لم تُراجع منذ الإتمام" : "أقدم جزء رُوجع في"} <bdi dir="ltr">{o.since}</bdi> · منذ{" "}
                {o.daysSince} يومًا
              </span>
              <span className={styles.reviewAction}>تسجيل مراجعة ←</span>
            </button>
          ))}
        </Collapsible>
      )}

      {infoSection}

      {progressBars.length > 0 && (
        <Collapsible title="أشرطة التقدّم" tag={progressHint} {...section("progress")}>
          <div className={styles.progressListBare}>
            {progressBars.map((bar) => (
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
        </Collapsible>
      )}

      <Collapsible title="الإنجاز" tag={`${cumPoints} نقطة تراكميًا`} {...section("achievement")}>
        <div className={styles.counters}>
          <div className={styles.counter}>
            <div className={styles.num}>{pointsForSelectedDate}</div>
            <div className={styles.lbl}>{sessionDate === today ? "نقاط اليوم" : `نقاط ليوم ${sessionDate}`}</div>
          </div>
          <div className={`${styles.counter} ${styles.gold}`}>
            <div className={styles.num}>{cumPoints}</div>
            <div className={styles.lbl}>نقاط الدورة (تراكمي)</div>
          </div>
          <div className={`${styles.counter} ${styles.sage}`}>
            <div className={styles.num}>{Math.min(100, Math.round((coveredPages / totalPages) * 1000) / 10)}٪</div>
            <div className={styles.lbl}>من إنجاز القرآن كامل ({totalPages} صفحة)</div>
          </div>
          {streak && (
            <div className={`${styles.counter} ${styles.gold}`}>
              <div className={styles.num}>🔥 {streak.weeks}</div>
              <div className={styles.lbl}>
                {streakText(streak.weeks)} · {STREAK_MODE_LABEL[streak.mode]}
              </div>
            </div>
          )}
        </div>
      </Collapsible>

      <Collapsible title="سجل التسميع" tag={historyHint} {...section("history")}>
        {history.length === 0 ? (
          <div className={styles.logEmpty}>
            لا يوجد تسميع مسجّل بعد ل{thisDemonstrative(groupGender)} {pickByGroup(groupGender, { m: "الطالب", f: "الطالبة" })}
          </div>
        ) : (
          history.map((e) => (
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
                    <>
                      {e.quality && (
                        <span className={`${styles.logBadge} ${styles[QUALITY_BADGE[e.quality]]}`}>
                          {QUALITY_LABEL[e.quality]}
                        </span>
                      )}
                      <span className={`${styles.logBadge} ${styles.mode}`}>
                        {e.mode === "ONLINE" ? "أونلاين" : "حضوري"}
                      </span>
                      {e.type !== "NEW" && (
                        <span className={`${styles.logBadge} ${styles.typeBadge}`}>↺ {SESSION_TYPE_LABEL[e.type]}</span>
                      )}
                    </>
                  )}
                  <span className={styles.logTeacher}>بواسطة {e.teacherName}</span>
                </div>
                {e.reason && <div className={styles.logReason}>سبب: {e.reason}</div>}
                {e.notes && <div className={styles.logNotes}>&quot;{e.notes}&quot;</div>}
              </div>
            </div>
          ))
        )}
      </Collapsible>

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
