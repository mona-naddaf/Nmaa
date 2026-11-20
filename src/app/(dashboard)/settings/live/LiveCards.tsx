"use client";

import { useEffect, useRef, useState } from "react";
import { pickByPerson, supervisorNoun, type PersonGender } from "@/lib/text/gender";
import { COURSE_EXCUSE_NO_TRACKER, EXCUSE_SWITCH, courseExcuseDesc } from "@/lib/excuse/texts";
import { DEFAULT_REVIEW_REMINDER_DAYS } from "@/lib/students/review";
import { TargetsEditor } from "@/components/home-log/TargetsEditor";
import type { HomeTargets } from "@/lib/home-log/rules";
import { SavedNote } from "@/components/nudge/SavedNote";
import { trackSave } from "@/components/leave-guard/LeaveGuard";
import type { StreakMode } from "@/lib/students/streak";
import {
  setAddStudentsPermissionAction,
  setCalendarBannerEnabledAction,
  setCalendarEditPermissionAction,
  setCalendarEnabledAction,
  setCourseExcuseAction,
  setHomeDefaultTargetsAction,
  setHomeLogEnabledAction,
  setHomeMistakesEnabledAction,
  setMutashabihatAction,
  setOnlineRecitationEnabledAction,
  setProgressBarAction,
  setReviewReminderDaysAction,
  setStreakModeAction,
  setStudentBoardEnabledAction,
  setStudentFeatureEnabledAction,
  setStudentLoginEnabledAction,
  setStudentPermissionAction,
  setTajweedDetailEnabledAction,
  setTeacherGroupAssignmentAction,
  setVisibilityModeAction,
  type ProgressBarField,
  type StudentPermissionField,
} from "../actions";
import { Choice, ON_OFF, SAVE_FAILED, SettingRow, useLiveSave } from "./Choice";
import styles from "../settings.module.css";

// The settings page's cards with their choices saved at once (./Choice.tsx),
// word for word the cards one folder up otherwise. Only for the courses in
// COURSE_GUIDE_EMAILS until they open to everyone; then these replace those.

// staff with no gender recorded read feminine (as in «أيام العذر»)
const her = (g: PersonGender): "MALE" | "FEMALE" => g ?? "FEMALE";

export function LiveOnline({ enabled }: { enabled: boolean }) {
  return (
    <SettingRow
      title="التسميع الأونلاين"
      desc="السماح بتسجيل تسميع تمّ عن بُعد (اتصال/مكالمة)، بنفس نظام السورة والآيات، مع تمييزه عن التسميع الحضوري وإضافة عدّاد خاص به لكل طالب."
      saved={enabled}
      options={ON_OFF}
      request={(v) => setOnlineRecitationEnabledAction(v)}
      last
    />
  );
}

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

export function LiveProgressBars({ enabled }: { enabled: Record<ProgressBarField, boolean> }) {
  return (
    <>
      {BARS.map((bar) => (
        <SettingRow
          key={bar.field}
          title={bar.title}
          desc={bar.desc}
          saved={enabled[bar.field]}
          options={ON_OFF}
          request={(v) => setProgressBarAction(bar.field, v)}
        />
      ))}
    </>
  );
}

export function LiveStreak({ mode }: { mode: StreakMode | null }) {
  return (
    <SettingRow
      title="متى يُحتسب الأسبوع؟"
      desc={
        <>
          تظهر علامة 🔥 بعدد الأسابيع المتتالية على بطاقة الطالب وفي صفحته. &quot;بالحضور&quot;: حضر مرة واحدة على الأقل في الأسبوع.
          &quot;بالتسميع&quot;: سُجّلت له جلسة حفظ أو مراجعة أو ربط في الأسبوع. يبدأ الأسبوع يوم الأحد، والأسبوع الذي لم يُسجَّل فيه شيء
          لأي أحد من مجموعته (إجازة مثلًا) لا يقطع السلسلة.
        </>
      }
      saved={mode}
      options={[
        { value: "ATTENDANCE", label: "بالحضور" },
        { value: "RECITATION", label: "بالتسميع" },
        { value: null, label: "غير مفعّل" },
      ]}
      request={(v) => setStreakModeAction(v)}
      last
    />
  );
}

// days typed: saved ~1 s after typing stops, or on leaving the field
const DAYS_WAIT_MS = 1000;
const MAX_DAYS = 365;

export function LiveReview({ days, adminGender }: { days: number | null; adminGender: PersonGender }) {
  const on = useLiveSave(days !== null);
  const [saved, setSaved] = useState(days ?? DEFAULT_REVIEW_REMINDER_DAYS);
  const [draft, setDraft] = useState(String(days ?? DEFAULT_REVIEW_REMINDER_DAYS));
  const [stamp, setStamp] = useState(0);
  const [line, setLine] = useState<string | null>(null);
  const timer = useRef(0);
  const y = (m: string, f: string) => pickByPerson(her(adminGender), { m, f });
  // a fresh value from the server
  const [seen, setSeen] = useState(days);
  if (seen !== days) {
    setSeen(days);
    if (days !== null) {
      setSaved(days);
      setDraft(String(days));
    }
  }
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = (text: string) => {
    window.clearTimeout(timer.current);
    const n = Number(text);
    if (!Number.isInteger(n) || n < 1 || n > MAX_DAYS) {
      // the last saved value stays
      setLine(`${y("اكتب", "اكتبي")} عددًا من 1 إلى ${MAX_DAYS}. بقيت المدة ${saved} يومًا.`);
      setDraft(String(saved));
      return;
    }
    setLine(null);
    if (n === saved) return;
    setStamp(0);
    void trackSave(setReviewReminderDaysAction(n))
      .catch(() => ({ error: SAVE_FAILED }))
      .then((r) => {
        if (r?.error) {
          setLine(r.error);
          setDraft(String(saved));
          return;
        }
        setSaved(n);
        setStamp(Date.now());
      });
  };

  return (
    <div className={styles.settingRow} style={{ borderBottom: "none" }}>
      <div className={styles.settingText}>
        <div className={styles.settingTitle}>مدة عدم المراجعة</div>
        <div className={styles.settingDesc}>
          تظهر علامة 🔁 على بطاقة الطالب في القائمة إذا مضت هذه المدة على أي سورة أتمّ حفظها دون أن تُراجَع كاملةً (بجلسة
          &quot;مراجعة&quot; أو &quot;ربط&quot;)، وتظهر السور المعنية في صفحته.
        </div>
        {on.value && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <input
              type="number"
              min={1}
              max={MAX_DAYS}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                window.clearTimeout(timer.current);
                const text = e.target.value;
                timer.current = window.setTimeout(() => commit(text), DAYS_WAIT_MS);
              }}
              onBlur={(e) => commit(e.target.value)}
              aria-label="عدد الأيام"
              style={{
                width: 90,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--line)",
                background: "var(--cream)",
                fontSize: 14,
                color: "var(--ink)",
              }}
            />
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>يومًا</span>
            <SavedNote stamp={stamp} className={styles.savedNote} />
          </div>
        )}
        {line && (
          <div className={styles.err} role="status">
            {line}
          </div>
        )}
      </div>
      <Choice
        label="تذكير المراجعة"
        options={[...ON_OFF]}
        value={on.value}
        stamp={on.stamp}
        error={on.error}
        onChoose={(v) => on.save(v, () => setReviewReminderDaysAction(v ? saved || DEFAULT_REVIEW_REMINDER_DAYS : null))}
      />
    </div>
  );
}

export function LiveExcuse({ enabled, trackerEnabled, adminGender }: { enabled: boolean; trackerEnabled: boolean; adminGender: PersonGender }) {
  const s = useLiveSave(enabled);
  return (
    <SettingRow
      title={EXCUSE_SWITCH}
      desc={courseExcuseDesc(adminGender)}
      saved={enabled}
      state={s}
      options={ON_OFF}
      request={(v) => setCourseExcuseAction(v)}
      last
    >
      {s.value && !trackerEnabled && <div className={styles.settingDesc}>{COURSE_EXCUSE_NO_TRACKER}</div>}
    </SettingRow>
  );
}

export function LiveStudentLogin({
  enabled,
  boardEnabled,
  homeLogEnabled,
  homeTargets,
  homeMistakesEnabled,
  assignmentsEnabled,
  trackerEnabled,
  trackerAgendaEnabled,
  trackerSummaryEnabled,
}: {
  enabled: boolean;
  boardEnabled: boolean;
  homeLogEnabled: boolean;
  homeTargets: HomeTargets;
  homeMistakesEnabled: boolean;
  assignmentsEnabled: boolean;
  trackerEnabled: boolean;
  trackerAgendaEnabled: boolean;
  trackerSummaryEnabled: boolean;
}) {
  const login = useLiveSave(enabled);
  const home = useLiveSave(homeLogEnabled);
  const tracker = useLiveSave(trackerEnabled);
  const on = login.value;
  const needLogin = on ? null : { why: "يتاح بعد تفعيل دخول الطلاب.", at: "setting-studentLogin" };
  const needHome = needLogin ?? (home.value ? null : { why: "يتاح بعد تفعيل «حفظي في البيت».", at: "setting-homeLog" });
  const needTracker = needLogin ?? (tracker.value ? null : { why: "يتاح بعد تفعيل جدول المتابعة.", at: "setting-tracker" });
  return (
    <>
      <SettingRow
        id="setting-studentLogin"
        title="دخول الطلاب"
        desc="يدخل كل طالب بالاسم ورمز خاص به (منفصل عن رمز وليّ الأمر)، ليرى موقعه في الخطة وأشرطة التقدّم والكلمات التي يتدرّب عليها ونقاطه، للعرض فقط. عند الإيقاف تُخفى رموز الطلاب ويُرفض دخولهم، وتنتهي جلساتهم المفتوحة."
        saved={enabled}
        state={login}
        options={ON_OFF}
        request={(v) => setStudentLoginEnabledAction(v)}
      />
      <SettingRow
        title="لوحة الإنجاز للطلاب"
        desc={
          <>
            إظهار لوحة إنجاز الدورة للطلاب بعد دخولهم (بأسماء جميع طلاب الدورة ونقاطهم وصفحاتهم)، مستقلًا عن رمز لوحة الإنجاز العامة.
            {!on && " (يتاح بعد تفعيل دخول الطلاب)"}
          </>
        }
        saved={boardEnabled}
        options={ON_OFF}
        request={(v) => setStudentBoardEnabledAction(v)}
        needs={needLogin}
      />
      <SettingRow
        id="setting-homeLog"
        title="حفظي في البيت"
        desc={
          <>
            يسجّل الطالب ما يحفظه في البيت: مقطعًا من السورة مع عدّادات للسماع والتكرار والتسميع لأحد، ويتابع تقدّمه نحو الأهداف. سجلّ
            منفصل لا يغيّر موقعه الرسمي في الخطة؛ لا يتقدّم الموقع إلا بتسميع يسجّله المعلم. ويظهر للمعلمين في صفحة الطالب، ولوليّ الأمر
            للعرض فقط.
            {!on && " (يتاح بعد تفعيل دخول الطلاب)"}
          </>
        }
        saved={homeLogEnabled}
        state={home}
        options={ON_OFF}
        request={(v) => setHomeLogEnabledAction(v)}
        needs={needLogin}
      >
        {on && home.value && (
          <div style={{ marginTop: 12 }}>
            <div className={styles.settingDesc} style={{ fontWeight: 700, marginBottom: 6 }}>
              الأهداف الافتراضية لكل مقطع جديد (يمكن للمعلم تعديلها لكل طالب):
            </div>
            <TargetsEditor initial={homeTargets} onSave={setHomeDefaultTargetsAction} />
          </div>
        )}
      </SettingRow>
      <SettingRow
        title="تحديد الطالب لأخطائه في حفظ البيت"
        desc={
          <>
            يحدّد الطالب بنفسه، وهو يتدرّب على مقطع في «حفظي في البيت»، الكلمات التي أخطأ فيها (بالأنواع الأربعة نفسها)، ثم يعلّمها متقَنة
            حين يتقنها. وهي خاصة به وحده: لا تظهر للمعلمين ولا للمشرفين ولا لوليّ الأمر، ولا تدخل في التقارير ولا في قائمة الأخطاء الرسمية،
            ولا تؤثّر في النقاط أو الموقع.
            {on && !home.value && " (يتاح بعد تفعيل «حفظي في البيت»)"}
            {!on && " (يتاح بعد تفعيل دخول الطلاب)"}
          </>
        }
        saved={homeMistakesEnabled}
        options={ON_OFF}
        request={(v) => setHomeMistakesEnabledAction(v)}
        needs={needHome}
      />
      <SettingRow
        title="الواجبات"
        desc={
          <>
            يكلّف المعلم مجموعة كاملة أو طلابًا محدّدين بواجب (حفظ من القرآن، سؤال، بحث، أو غير ذلك) مع موعد تسليم اختياري، ويعلّم الطالب ما
            أنجزه. ويرى المعلمون من أنجز ومن لم ينجز، ووليّ الأمر للعرض فقط. لا تُمنح نقاط تلقائيًا.
            {on && !home.value && " واجبات الحفظ تحتاج إلى تفعيل «حفظي في البيت»."}
            {!on && " (يتاح بعد تفعيل دخول الطلاب)"}
          </>
        }
        saved={assignmentsEnabled}
        options={ON_OFF}
        request={(v) => setStudentFeatureEnabledAction("assignments", v)}
        needs={needLogin}
      />
      <SettingRow
        id="setting-tracker"
        title="جدول المتابعة"
        desc={
          <>
            بنود يومية يعلّمها الطالب (مثل الورد أو أذكار الصباح)، لكل بند درجة، مع مجموع لليوم وللأسبوع. ويمكن للطالب اقتراح بنود خاصة به
            يعتمدها المعلم. ويظهر للمعلمين في صفحة الطالب وجدول للمجموعة، ولوليّ الأمر للعرض فقط.
            {!on && " (يتاح بعد تفعيل دخول الطلاب)"}
          </>
        }
        saved={trackerEnabled}
        state={tracker}
        options={ON_OFF}
        request={(v) => setStudentFeatureEnabledAction("tracker", v)}
        needs={needLogin}
      />
      <SettingRow
        title="الجدول اليومي"
        desc={
          <>
            ترتيب بنود جدول المتابعة وأوقاتها، مع جدول اليوم وبطاقة «الآن» للطالب. يحدّد المعلم ترتيب بنود المجموعة وأوقاتها، ويستطيع الطالب
            تغيير الأوقات وترتيب البنود لنفسه وإضافة بنوده الخاصة، ولا يستطيع حذف بنود المعلم. لا يغيّر شيئًا في الدرجات.
            {!(on && tracker.value) && " (يتاح بعد تفعيل جدول المتابعة)"}
          </>
        }
        saved={trackerAgendaEnabled}
        options={ON_OFF}
        request={(v) => setStudentFeatureEnabledAction("trackerAgenda", v)}
        needs={needTracker}
      />
      <SettingRow
        title="المحصّلات"
        desc={
          <>
            ملخّص لكل أسبوع وشهر وربع ونصف سنة وسنة: نسبة الالتزام في كل بند وإجمالًا، وفسيفساء للأيام، ومقارنة بالفترة السابقة، وما أُنجز من
            حفظ وتسميع. يراها الطالب في صفحته، والمعلم في صفحة الطالب، ووليّ الأمر في صفحته، ويُحسب من سجل الجدول الموجود.
            {!(on && tracker.value) && " (يتاح بعد تفعيل جدول المتابعة)"}
          </>
        }
        saved={trackerSummaryEnabled}
        options={ON_OFF}
        request={(v) => setStudentFeatureEnabledAction("trackerSummary", v)}
        needs={needTracker}
        last
      />
    </>
  );
}

export function LiveSimilar({
  teachers,
  students,
  studentLoginEnabled,
  homeLogEnabled,
}: {
  teachers: boolean;
  students: boolean;
  studentLoginEnabled: boolean;
  homeLogEnabled: boolean;
}) {
  // students see the marks inside «حفظي في البيت», which needs student login
  const studentsNote = !studentLoginEnabled
    ? "لا يعمل إلا بعد تفعيل دخول الطلاب."
    : !homeLogEnabled
      ? "لا يعمل إلا بعد تفعيل «حفظي في البيت» في بطاقة دخول الطلاب."
      : null;
  return (
    <>
      <div className={styles.settingRow}>
        <div className={styles.settingText}>
          <div className={styles.settingDesc}>
            علامة صغيرة «≈» بعد الآية التي لها آيات متشابهة في مواضع أخرى من القرآن، وعند الضغط عليها تظهر تلك الآيات مع تمييز الموضع المشترك
            في كل منها. المصدر: بيانات المتشابهات من QUL (ترتيل).
          </div>
        </div>
      </div>
      <SettingRow
        title="للمعلمين والمشرفين"
        desc="في نص التسميع عند تحديد الأخطاء في صفحة الطالب، دون أن تعيق اختيار الكلمات."
        saved={teachers}
        options={ON_OFF}
        request={(v) => setMutashabihatAction("teachers", v)}
      />
      <SettingRow
        title="للطلاب"
        desc={
          <>
            في «حفظي في البيت»: عند اختيار مقطع جديد وفي صفحة التدريب. لا تظهر لأولياء الأمور.
            {studentsNote && <div style={{ color: "var(--gold-deep)", marginTop: 4 }}>{studentsNote}</div>}
          </>
        }
        saved={students}
        options={ON_OFF}
        request={(v) => setMutashabihatAction("students", v)}
        last
      />
    </>
  );
}

export function LiveTajweed({ enabled }: { enabled: boolean }) {
  const s = useLiveSave(enabled);
  return (
    <SettingRow
      desc={
        <>
          لمن يُحاسَب على التجويد بدقّة: عند اختيار مخرج أو صفة أو حكم تجويد تنقسم الكلمة إلى حروفها، فيُحدَّد الحرف نفسه وما فيه من خطأ،
          ويمكن تحديد خطأ بين كلمتين (كأحكام النون والميم والوقف والابتداء). يُفعَّل لكل طالب وطالبة من صفحته بخيار «محاسبة على التجويد
          المفصّل». رواية حفص عن عاصم من طريق الشاطبية.
          {!s.value && <div style={{ marginTop: 4 }}>عند الإيقاف تبقى الأخطاء المفصّلة المحفوظة ظاهرة بتفاصيلها، ولا تُضاف أخطاء مفصّلة جديدة.</div>}
        </>
      }
      title="أخطاء التجويد المفصّلة"
      saved={enabled}
      state={s}
      options={ON_OFF}
      request={(v) => setTajweedDetailEnabledAction(v)}
      last
    />
  );
}

export function LiveCalendar({
  enabled,
  bannerEnabled,
  editPermission,
  adminGender,
}: {
  enabled: boolean;
  bannerEnabled: boolean;
  editPermission: "ADMIN_ONLY" | "ALL_TEACHERS";
  adminGender: PersonGender;
}) {
  const cal = useLiveSave(enabled);
  const needCal = cal.value ? null : { why: "يتاح بعد تفعيل التقويم.", at: "setting-calendar" };
  return (
    <>
      <SettingRow
        id="setting-calendar"
        title="التقويم الهجري"
        desc="صفحة &quot;التقويم&quot; للمعلمين والإشراف: المناسبات الإسلامية بالتاريخين الهجري والميلادي مع العدّ التنازلي، وفعاليات الدورة القادمة والسابقة. لا تظهر لأولياء الأمور ولا في لوحة الإنجاز العامة."
        saved={enabled}
        state={cal}
        options={ON_OFF}
        request={(v) => setCalendarEnabledAction(v)}
      />
      <SettingRow
        title="شريط العدّ التنازلي في الصفحة الرئيسية"
        desc={
          <>
            شريط صغير أعلى قائمة الطلاب يعرض أقرب مناسبة أو فعالية قادمة وعدد الأيام المتبقية عليها.
            {!cal.value && " (يتاح بعد تفعيل التقويم)"}
          </>
        }
        saved={bannerEnabled}
        options={ON_OFF}
        request={(v) => setCalendarBannerEnabledAction(v)}
        needs={needCal}
      />
      <SettingRow
        title="إدارة الفعاليات والمناسبات"
        desc={
          <>
            من يملك صلاحية إضافة الفعاليات وتعديلها وحذفها، وتفعيل المناسبات الاختيارية؟ عند اختيار &quot;كل المعلمين&quot; يعدّل كل معلم
            الفعاليات التي أضافها فقط. أما تعديل مواعيد المناسبات بحسب رؤية الهلال فيبقى لل{supervisorNoun(adminGender)}{" "}
            {pickByPerson(adminGender, { m: "وحده", f: "وحدها" })}.
          </>
        }
        saved={editPermission}
        options={[
          { value: "ADMIN_ONLY", label: `ال${supervisorNoun(adminGender)} فقط` },
          { value: "ALL_TEACHERS", label: "كل المعلمين" },
        ]}
        request={(v) => setCalendarEditPermissionAction(v)}
        needs={needCal}
        last
      />
    </>
  );
}

type Perm = "ADMIN_ONLY" | "ALL_TEACHERS";

export function LivePermissions({
  addStudentsPermission,
  editStudentsPermission,
  archiveStudentsPermission,
  addPriorPermission,
  offlineSheetPermission,
  editPlanPermission,
  issueStudentCodesPermission,
  studentLoginEnabled,
  studentInfoEnabled,
  adminGender,
  visibilityMode,
  groups,
  teachers,
}: {
  addStudentsPermission: Perm;
  editStudentsPermission: Perm;
  archiveStudentsPermission: Perm;
  addPriorPermission: Perm;
  offlineSheetPermission: Perm;
  editPlanPermission: Perm;
  issueStudentCodesPermission: Perm;
  studentLoginEnabled: boolean;
  studentInfoEnabled: boolean;
  adminGender: PersonGender;
  visibilityMode: "ALL_TEACHERS" | "ASSIGNED";
  groups: { id: string; name: string }[];
  teachers: { id: string; name: string; groupId: string | null }[];
}) {
  const options = [
    { value: "ADMIN_ONLY" as Perm, label: `ال${supervisorNoun(adminGender)} فقط` },
    { value: "ALL_TEACHERS" as Perm, label: "كل المعلمين" },
  ];
  const row = (field: StudentPermissionField, saved: Perm, title: string, desc: string) => (
    <SettingRow key={field} title={title} desc={desc} saved={saved} options={options} request={(v) => setStudentPermissionAction(field, v)} />
  );
  const visibility = useLiveSave(visibilityMode);
  return (
    <div>
      <SettingRow
        title="إضافة طلاب جدد"
        desc="من يملك صلاحية إضافة طالب جديد إلى الدورة؟"
        saved={addStudentsPermission}
        options={options}
        request={(v) => setAddStudentsPermissionAction(v)}
      />
      {row(
        "editStudentsPermission",
        editStudentsPermission,
        "تعديل بيانات الطلاب",
        studentInfoEnabled
          ? "من يملك صلاحية تعديل الاسم والعمر والصف والمجموعة، والمعلومات الإضافية التي تظهر للمعلمين؟"
          : "من يملك صلاحية تعديل الاسم والعمر والصف والمجموعة؟",
      )}
      {row(
        "archiveStudentsPermission",
        archiveStudentsPermission,
        "أرشفة الطلاب",
        `من يملك صلاحية أرشفة طالب؟ أما الاستعادة من الأرشيف والحذف النهائي فهما لل${supervisorNoun(adminGender)} ${pickByPerson(adminGender, { m: "وحده", f: "وحدها" })} دائمًا.`,
      )}
      {row(
        "addPriorPermission",
        addPriorPermission,
        "إضافة حفظ سابق",
        "من يملك صلاحية إضافة حفظ سابق لطالب موجود (أو حذف حفظ سابق أُضيف بالخطأ)؟ يُحسب في موضعه وأشرطة تقدّمه، دون نقاط أو أثر في لوحة الإنجاز.",
      )}
      {row(
        "offlineSheetPermission",
        offlineSheetPermission,
        "التسميع بدون إنترنت",
        'من يملك صلاحية تنزيل ملف Excel لتسجيل حضور يوم وتسميعه ونقاطه دون اتصال، ثم رفعه وحفظه؟ عند اختيار "كل المعلمين" يقتصر كل معلم على طلاب مجموعاته.',
      )}
      {row(
        "editPlanPermission",
        editPlanPermission,
        "تعديل خطة الحفظ",
        'من يملك صلاحية تغيير خطة حفظ طالب، وتصحيح اتجاه أي جزء في خطة «ترتيب المصحف بالعكس»؟ عند اختيار "كل المعلمين" يقتصر كل معلم على الطلاب الذين يراهم.',
      )}
      {studentLoginEnabled &&
        row(
          "issueStudentCodesPermission",
          issueStudentCodesPermission,
          "إصدار رموز الطلاب",
          'من يملك صلاحية إنشاء رموز دخول الطلاب وتجديدها وإلغائها؟ عند اختيار "كل المعلمين" يصدر كل معلم رموز طلاب مجموعاته المخصّصة فقط.',
        )}

      <div className={styles.settingRow} style={{ flexDirection: "column", alignItems: "stretch" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div className={styles.settingText}>
            <div className={styles.settingTitle}>رؤية الطلاب</div>
            <div className={styles.settingDesc}>هل يشاهد كل معلم كل الطلاب، أم فقط الطلاب المخصّصين له؟</div>
          </div>
          <Choice
            label="رؤية الطلاب"
            options={[
              { value: "ALL_TEACHERS", label: "كل المعلمين لكل الطلاب" },
              { value: "ASSIGNED", label: "تخصيص لكل معلم" },
            ]}
            value={visibility.value}
            stamp={visibility.stamp}
            error={visibility.error}
            onChoose={(v) => visibility.save(v, () => setVisibilityModeAction(v))}
          />
        </div>

        {visibility.value === "ASSIGNED" && (
          <div className={styles.assignBox}>
            <div className={styles.aTitle}>تخصيص المجموعات لكل معلم</div>
            {teachers.length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>لم يسجّل أي معلم دخوله بعد — سيظهر هنا فور تسجيل دخوله لأول مرة</div>
            )}
            {teachers.map((t) => (
              <TeacherGroup key={t.id} teacher={t} groups={groups} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TeacherGroup({ teacher, groups }: { teacher: { id: string; name: string; groupId: string | null }; groups: { id: string; name: string }[] }) {
  const s = useLiveSave(teacher.groupId ?? "");
  return (
    <div className={styles.assignRow}>
      <span>{teacher.name}</span>
      <select
        value={s.value}
        aria-label={`مجموعة ${teacher.name}`}
        onChange={(e) => {
          const v = e.target.value;
          s.save(v, () => setTeacherGroupAssignmentAction(teacher.id, v || null));
        }}
      >
        <option value="">كل المجموعات</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <SavedNote stamp={s.stamp} className={styles.savedNote} />
      {s.error && <div className={styles.err}>{s.error}</div>}
    </div>
  );
}
