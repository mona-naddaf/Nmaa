"use client";

import { useActionState, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { WeekdayPicker } from "@/components/student-work/TrackerControls";
import { localToday } from "@/lib/home-log/rules";
import { daysLabel } from "@/lib/tracker/rules";
import { dayOfInstant, useToday } from "@/lib/calendar/useToday";
import hl from "@/components/home-log/home-log.module.css";
import styles from "../../rafiq.module.css";
import { RecoveryCodeCard } from "../../RecoveryCodeCard";
import { ACCOUNT_LIMITS, DELETE_CONFIRM_WORD, REVIEW_DAYS_MAX, REVIEW_DAYS_MIN, parseReviewDays, type RafiqGender } from "@/lib/rafiq/rules";
import { LeaveGuard, trackSave } from "@/components/leave-guard/LeaveGuard";
import { SavedNote } from "@/components/nudge/SavedNote";
import { pickByPerson } from "@/lib/text/gender";
import { CityPicker } from "@/components/prayer/CityPicker";
import type { PrayerLocation } from "@/lib/prayer/times";
import {
  changePasswordAction,
  deleteAccountAction,
  regenerateRecoveryCodeAction,
  setCommitDaysAction,
  setAgendaEnabledAction,
  setPlaceAction,
  setSummaryEnabledAction,
  setMutashabihatEnabledAction,
  setTajweedDetailEnabledAction,
  setReviewRemindersAction,
  signOutEverywhereAction,
  updateProfileAction,
  type SettingsState,
} from "./actions";

type Props = {
  email: string;
  name: string | null;
  gender: RafiqGender;
  recoveryCodeCreatedAt: string;
  reviewReminderDays: number | null;
  commitDays: number;
  agendaEnabled: boolean;
  summaryEnabled: boolean;
  similarEnabled: boolean;
  // «أخطاء التجويد المفصّلة» (off by default)
  tajweedEnabled: boolean;
  // her place for prayer times (null: none)
  place: PrayerLocation | null;
};

export function SettingsView({ email, name, gender, recoveryCodeCreatedAt, reviewReminderDays, commitDays, agendaEnabled, summaryEnabled, similarEnabled, tajweedEnabled, place }: Props) {
  const p = (m: string, f: string) => pickByPerson(gender, { m, f });

  return (
    <div className={styles.settingsGrid}>
      <div className={hl.sectionTitle} style={{ margin: "0 4px" }}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>الإعدادات</span>
      </div>
      <Profile email={email} name={name} gender={gender} />
      <CommitDays p={p} initial={commitDays} />
      <ReviewReminders p={p} days={reviewReminderDays} />
      <Agenda p={p} enabled={agendaEnabled} />
      <div className={hl.section} id="city">
        <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
          المدينة (لمواقيت الصلاة)
        </div>
        <CityPicker
          initial={place}
          previewZone={null}
          intro={`تحديد ${p("مدينتك", "مدينتكِ")} يتيح في الجدول اليومي أوقاتًا بالنسبة إلى الصلاة (مثل «بعد الفجر» أو «قبل المغرب بـ 15 دقيقة») تتغيّر مع المواسم، وتظهر مواقيت اليوم على جدول يومك.`}
          onSave={setPlaceAction}
        />
      </div>
      <Summaries p={p} enabled={summaryEnabled} />
      <Similar p={p} enabled={similarEnabled} />
      <TajweedDetail p={p} enabled={tajweedEnabled} />
      <Password p={p} />
      <Recovery p={p} gender={gender} createdAt={recoveryCodeCreatedAt} />
      <div className={hl.section}>
        <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
          الأجهزة
        </div>
        <p className={hl.muted} style={{ marginTop: 0 }}>
          {p("إن دخلتَ", "إن دخلتِ")} من جهاز لا {p("تملكه", "تملكينه")}، {p("يمكنك", "يمكنكِ")} إنهاء جميع الجلسات المفتوحة،
          بما فيها هذه الجلسة.
        </p>
        <form action={signOutEverywhereAction}>
          <button type="submit" className={hl.ghostBtn}>
            تسجيل الخروج من جميع الأجهزة
          </button>
        </form>
      </div>
      <DeleteAccount p={p} />
      <LeaveGuard />
    </div>
  );
}

type P = (m: string, f: string) => string;

function Feedback({ state }: { state: SettingsState }) {
  if (state?.error) return <div className={hl.err} style={{ marginBottom: 10 }}>{state.error}</div>;
  if (state?.ok) return <div className={styles.okMsg}>{state.ok}</div>;
  return null;
}

function Profile({ email, name, gender }: { email: string; name: string | null; gender: RafiqGender }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateProfileAction, null);
  return (
    <form className={hl.section} action={action}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 10px" }}>
        بياناتي
      </div>
      <div className={styles.formField}>
        <span className={styles.fieldLabel}>البريد الإلكتروني</span>
        <div dir="ltr" style={{ textAlign: "right", fontSize: 14 }}>
          {email}
        </div>
      </div>
      <div className={styles.formField}>
        <label className={styles.fieldLabel} htmlFor="name">
          الاسم (اختياري)
        </label>
        <input id="name" name="name" className={styles.input} defaultValue={name ?? ""} maxLength={ACCOUNT_LIMITS.nameMax} />
      </div>
      <div className={styles.formField}>
        <span className={styles.fieldLabel} id="genderLabel">
          الجنس
        </span>
        <div className={styles.genderSwitch} role="radiogroup" aria-labelledby="genderLabel">
          <label>
            <input type="radio" name="gender" value="FEMALE" defaultChecked={gender === "FEMALE"} />
            أنثى
          </label>
          <label>
            <input type="radio" name="gender" value="MALE" defaultChecked={gender === "MALE"} />
            ذكر
          </label>
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={hl.primaryBtn} disabled={pending}>
        {pending ? "جارٍ الحفظ…" : "حفظ"}
      </button>
    </form>
  );
}

const FAIL = "تعذّر حفظ الإعداد، يُرجى المحاولة مرة أخرى";

type FormAction = (prev: SettingsState, formData: FormData) => Promise<SettingsState>;

/** Calls a settings action the way its form used to. */
function send(action: FormAction, fields: Record<string, string>): Promise<SettingsState> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return action(null, fd);
}

/**
 * A setting changed at once and saved in the background (no «حفظ» button):
 * «تم الحفظ ✓» once saved, or put back with a short message when saving fails
 * (an error answer or none at all). Pending saves keep LeaveGuard on.
 */
function useAutoSave<T>(saved: T) {
  const router = useRouter();
  const [value, setValue] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [stamp, setStamp] = useState(0);
  const [, start] = useTransition();
  const save = (request: () => Promise<SettingsState>, before: T) => {
    setError(null);
    setStamp(0);
    start(async () => {
      const r = await trackSave(request()).catch(() => ({ error: FAIL }));
      if (r?.error) {
        setValue(before);
        setError(FAIL);
        return;
      }
      setStamp(Date.now());
      router.refresh();
    });
  };
  return { value, setValue, error, setError, stamp, save };
}

// taps on the weekdays within this long are saved together
const COMMIT_BATCH_MS = 600;

function CommitDays({ p, initial }: { p: P; initial: number }) {
  const t = useAutoSave(initial);
  const [saved, setSaved] = useState(initial);
  const [hint, setHint] = useState(false);
  // one save for a burst of taps; the burst counts as a pending save from its first tap
  const burst = useRef<{ timer: number; done: () => void } | null>(null);
  const change = (days: number) => {
    t.setValue(days);
    setHint(false);
    if (burst.current) window.clearTimeout(burst.current.timer);
    else {
      let done = () => {};
      void trackSave(new Promise<void>((resolve) => (done = resolve)));
      burst.current = { timer: 0, done };
    }
    const b = burst.current;
    b.timer = window.setTimeout(() => {
      burst.current = null;
      if (days === saved) return b.done();
      t.save(
        () =>
          setCommitDaysAction({ days, today: localToday() })
            .then((r) => {
              if (!r?.error) setSaved(days);
              return r;
            })
            .finally(b.done),
        saved,
      );
    }, COMMIT_BATCH_MS);
  };
  return (
    <div className={hl.section} id="commit">
      <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
        أيام الالتزام
      </div>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        الأيام التي {p("تنوي", "تنوين")} فيها تسجيل جلسة (حفظ أو مراجعة أو ربط). يُحسب اليوم ملتزَمًا به إذا {p("سجّلتَ", "سجّلتِ")} فيه
        جلسة، ولا تقطع أيامُ الراحة السلسلةَ. يسري التغيير من اليوم، وتبقى الأيام السابقة على ما كانت عليه.
      </p>
      <WeekdayPicker days={t.value} onChange={change} onEmpty={() => setHint(true)} />
      <div className={hl.muted} style={{ margin: "6px 0 0" }}>
        الحالي: {daysLabel(saved)} <SavedNote stamp={t.stamp} />
      </div>
      {hint && (
        <div className={hl.err} role="alert" style={{ marginTop: 6 }}>
          {p("اختر", "اختاري")} يومًا واحدًا على الأقل
        </div>
      )}
      {t.error && <div className={hl.err} style={{ marginTop: 6 }}>{t.error}</div>}
    </div>
  );
}

// review days: saved this long after typing stops, or on leaving the field
const REVIEW_TYPING_MS = 1000;
// pre-filled when she turns reminders on (same default as courses)
const DEFAULT_REVIEW_DAYS = 14;

function ReviewReminders({ p, days }: { p: P; days: number | null }) {
  const on = useAutoSave(days !== null);
  const count = useAutoSave(days ?? DEFAULT_REVIEW_DAYS);
  const [text, setText] = useState(String(days ?? DEFAULT_REVIEW_DAYS));
  const [bad, setBad] = useState(false);
  const typing = useRef<number | null>(null);
  const request = (enabled: boolean, n: number) => () => send(setReviewRemindersAction, { on: enabled ? "1" : "0", days: String(n) });

  const toggle = (next: boolean) => {
    on.setValue(next);
    on.save(request(next, count.value), !next);
  };
  // saves the typed number, or keeps the last saved one and says why
  const commit = (raw: string, leaving: boolean) => {
    if (typing.current) window.clearTimeout(typing.current);
    typing.current = null;
    const n = parseReviewDays(raw);
    if (n === null) {
      setBad(true);
      if (leaving) setText(String(count.value));
      return;
    }
    setBad(false);
    if (leaving) setText(String(n));
    if (n === count.value) return;
    const before = count.value;
    count.setValue(n);
    count.save(request(true, n), before);
  };
  // a failed save puts the field back too
  const shown = count.error ? String(count.value) : text;

  return (
    <div className={hl.section}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
        تذكير المراجعة
      </div>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        يُنبّهك في صفحتك إلى كل سورة {p("أتممتَ", "أتممتِ")} حفظها ولم {p("تراجعها", "تراجعيها")} كاملةً منذ المدة التي {p("تحدّدها", "تحدّدينها")}.
      </p>
      <label className={styles.confirmRow}>
        <input type="checkbox" checked={on.value} onChange={(e) => toggle(e.target.checked)} />
        تفعيل تذكير المراجعة
        <SavedNote stamp={on.stamp} />
      </label>
      {on.error && <div className={hl.err} style={{ marginBottom: 10 }}>{on.error}</div>}
      {on.value && (
        <div className={styles.formField}>
          <label className={styles.fieldLabel} htmlFor="review-days">
            عدد الأيام
          </label>
          <div className={hl.actionsRow} style={{ alignItems: "center" }}>
            <input
              id="review-days"
              type="number"
              inputMode="numeric"
              min={REVIEW_DAYS_MIN}
              max={REVIEW_DAYS_MAX}
              className={styles.input}
              style={{ maxWidth: 120 }}
              value={shown}
              aria-invalid={bad || undefined}
              aria-describedby={bad ? "review-days-msg" : undefined}
              onChange={(e) => {
                const raw = e.target.value;
                setText(raw);
                count.setError(null);
                if (typing.current) window.clearTimeout(typing.current);
                typing.current = window.setTimeout(() => commit(raw, false), REVIEW_TYPING_MS);
              }}
              onBlur={(e) => commit(e.target.value, true)}
            />
            <SavedNote stamp={count.stamp} />
          </div>
          {bad && (
            <div id="review-days-msg" className={hl.err} style={{ marginTop: 6 }}>
              {p("اكتب", "اكتبي")} عددًا من {REVIEW_DAYS_MIN} إلى {REVIEW_DAYS_MAX}. بقي العدد السابق {count.value}.
            </div>
          )}
          {count.error && <div className={hl.err} style={{ marginTop: 6 }}>{count.error}</div>}
        </div>
      )}
    </div>
  );
}

/** A feature switch: on or off at once, saved in the background. */
function FeatureSwitch({ title, label, enabled, action, children }: { title: string; label: string; enabled: boolean; action: FormAction; children: ReactNode }) {
  const t = useAutoSave(enabled);
  const toggle = (next: boolean) => {
    t.setValue(next);
    t.save(() => send(action, { on: next ? "1" : "0" }), !next);
  };
  return (
    <div className={hl.section}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
        {title}
      </div>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        {children}
      </p>
      <label className={styles.confirmRow}>
        <input type="checkbox" checked={t.value} onChange={(e) => toggle(e.target.checked)} />
        {label}
        <SavedNote stamp={t.stamp} />
      </label>
      {t.error && <div className={hl.err}>{t.error}</div>}
    </div>
  );
}

function Agenda({ p, enabled }: { p: P; enabled: boolean }) {
  return (
    <FeatureSwitch title="الجدول اليومي" label="تفعيل الجدول اليومي" enabled={enabled} action={setAgendaEnabledAction}>
      {p("رتّب", "رتّبي")} بنود جدول المتابعة {p("وأعطِ", "وأعطي")} كل بند وقته، {p("لترى", "لتري")} جدول يومك وما {p("عليك", "عليكِ")} الآن وما
      بعده. لا يغيّر شيئًا في الدرجات.
    </FeatureSwitch>
  );
}

function Summaries({ p, enabled }: { p: P; enabled: boolean }) {
  return (
    <FeatureSwitch title="المحصّلات" label="تفعيل المحصّلات" enabled={enabled} action={setSummaryEnabledAction}>
      ملخّص لكل أسبوع وشهر وربع ونصف سنة وسنة من جدول المتابعة: نسبة {p("التزامك", "التزامكِ")} في كل بند وإجمالًا، وفسيفساء لأيامك، ومقارنة
      بالفترة السابقة، وما {p("أنجزته", "أنجزتِه")} من حفظ وتسميع.
    </FeatureSwitch>
  );
}

function Similar({ p, enabled }: { p: P; enabled: boolean }) {
  return (
    <FeatureSwitch title="المتشابهات" label="إظهار المتشابهات" enabled={enabled} action={setMutashabihatEnabledAction}>
      علامة صغيرة «≈» بعد الآية التي لها آيات متشابهة في مواضع أخرى من القرآن، في «صفحتي» و«حفظي في البيت» وصفحة الآية. عند الضغط
      عليها {p("ترى", "ترين")} تلك الآيات مع تمييز الموضع المشترك، {p("وتنتقل", "وتنتقلين")} إلى أيٍّ منها بلمسة. المصدر: بيانات
      المتشابهات من QUL (ترتيل).
    </FeatureSwitch>
  );
}

function TajweedDetail({ p, enabled }: { p: P; enabled: boolean }) {
  return (
    <FeatureSwitch title="أخطاء التجويد المفصّلة" label="تفعيل أخطاء التجويد المفصّلة" enabled={enabled} action={setTajweedDetailEnabledAction}>
      عند تحديد خطأ تجويد في جلساتك أو في «حفظي في البيت» {p("تختار", "تختارين")} مخرجًا أو صفة أو حكمًا، فتنقسم الكلمة إلى حروفها
      {p(" وتحدّد", " وتحدّدين")} الحرف نفسه، أو الخطأ بين كلمتين (كأحكام النون والميم والوقف والابتداء). ويظهر في «صفحتي» ملخّص أخطائك
      المفصّلة. رواية حفص عن عاصم من طريق الشاطبية. عند الإيقاف تبقى الأخطاء المفصّلة المحفوظة ظاهرة بتفاصيلها.
    </FeatureSwitch>
  );
}

function Password({ p }: { p: P }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(changePasswordAction, null);
  return (
    <form className={hl.section} action={action}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 10px" }}>
        كلمة المرور
      </div>
      <div className={styles.formField}>
        <label className={styles.fieldLabel} htmlFor="pw-current">
          كلمة المرور الحالية
        </label>
        <input id="pw-current" name="current" type="password" className={styles.input} autoComplete="current-password" required />
      </div>
      <div className={styles.formField}>
        <label className={styles.fieldLabel} htmlFor="pw-new">
          كلمة المرور الجديدة
        </label>
        <input id="pw-new" name="password" type="password" className={styles.input} autoComplete="new-password" minLength={ACCOUNT_LIMITS.passwordMin} required />
      </div>
      <div className={styles.formField}>
        <label className={styles.fieldLabel} htmlFor="pw-confirm">
          تأكيد كلمة المرور الجديدة
        </label>
        <input id="pw-confirm" name="confirm" type="password" className={styles.input} autoComplete="new-password" required />
      </div>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        ستخرج الأجهزة الأخرى من الحساب، {p("وتبقى", "وتبقين")} داخله على هذا الجهاز.
      </p>
      <Feedback state={state} />
      <button type="submit" className={hl.primaryBtn} disabled={pending}>
        {pending ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}
      </button>
    </form>
  );
}

function Recovery({ p, gender, createdAt }: { p: P; gender: RafiqGender; createdAt: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(regenerateRecoveryCodeAction, null);
  const [open, setOpen] = useState(false);
  // the day it was created on her own calendar, known once in her browser
  const ready = useToday() !== null;
  return (
    <div className={hl.section}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
        رمز الاستعادة
      </div>
      {state?.recoveryCode ? (
        <RecoveryCodeCard code={state.recoveryCode} gender={gender} />
      ) : (
        <>
          <p className={hl.muted} style={{ marginTop: 0 }}>
            {p("تحتاجه", "تحتاجينه")} لتعيين كلمة مرور جديدة إن {p("نسيتَها", "نسيتِها")}. آخر رمز أُنشئ في{" "}
            <bdi dir="ltr">{ready ? dayOfInstant(createdAt, null) : "…"}</bdi>. إنشاء رمز جديد يُلغي الرمز السابق.
          </p>
          {open ? (
            <form action={action}>
              <div className={styles.formField}>
                <label className={styles.fieldLabel} htmlFor="rc-current">
                  كلمة المرور الحالية
                </label>
                <input id="rc-current" name="current" type="password" className={styles.input} autoComplete="current-password" required />
              </div>
              <Feedback state={state} />
              <div className={hl.actionsRow}>
                <button type="submit" className={hl.primaryBtn} disabled={pending}>
                  {pending ? "جارٍ الإنشاء…" : "إنشاء رمز جديد"}
                </button>
                <button type="button" className={hl.ghostBtn} onClick={() => setOpen(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className={hl.ghostBtn} onClick={() => setOpen(true)}>
              إنشاء رمز استعادة جديد
            </button>
          )}
        </>
      )}
    </div>
  );
}

function DeleteAccount({ p }: { p: P }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(deleteAccountAction, null);
  const [open, setOpen] = useState(false);
  return (
    <div className={hl.section}>
      <div className={`${hl.sectionTitle} ${styles.dangerTitle}`} style={{ margin: "0 0 8px" }}>
        حذف الحساب
      </div>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        يُحذف الحساب وجميع ما فيه من حفظ ومتابعة نهائيًا، ولا يمكن التراجع عن ذلك. أمّا جداول المتابعة التي{" "}
        {p("نشرتَها", "نشرتِها")} في البنك فتبقى فيه دون اسم.
      </p>
      {open ? (
        <form action={action}>
          <div className={styles.formField}>
            <label className={styles.fieldLabel} htmlFor="del-word">
              {p("اكتب", "اكتبي")} «{DELETE_CONFIRM_WORD}» للتأكيد
            </label>
            <input id="del-word" name="confirmWord" className={styles.input} autoComplete="off" required />
          </div>
          <div className={styles.formField}>
            <label className={styles.fieldLabel} htmlFor="del-current">
              كلمة المرور الحالية
            </label>
            <input id="del-current" name="current" type="password" className={styles.input} autoComplete="current-password" required />
          </div>
          <Feedback state={state} />
          <div className={hl.actionsRow}>
            <button type="submit" className={styles.dangerBtn} disabled={pending}>
              {pending ? "جارٍ الحذف…" : "حذف الحساب نهائيًا"}
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setOpen(false)}>
              تراجع
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className={hl.ghostBtn} onClick={() => setOpen(true)}>
          حذف حسابي
        </button>
      )}
    </div>
  );
}
