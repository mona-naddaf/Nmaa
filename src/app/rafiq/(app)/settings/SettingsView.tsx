"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WeekdayPicker } from "@/components/student-work/TrackerControls";
import { localToday } from "@/lib/home-log/rules";
import { daysLabel } from "@/lib/tracker/rules";
import hl from "@/components/home-log/home-log.module.css";
import styles from "../../rafiq.module.css";
import { RecoveryCodeCard } from "../../RecoveryCodeCard";
import { ACCOUNT_LIMITS, DELETE_CONFIRM_WORD, type RafiqGender } from "@/lib/rafiq/rules";
import { pickByPerson } from "@/lib/text/gender";
import {
  changePasswordAction,
  deleteAccountAction,
  regenerateRecoveryCodeAction,
  setCommitDaysAction,
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
};

export function SettingsView({ email, name, gender, recoveryCodeCreatedAt, reviewReminderDays, commitDays }: Props) {
  const p = (m: string, f: string) => pickByPerson(gender, { m, f });

  return (
    <div className={styles.settingsGrid}>
      <div className={hl.sectionTitle} style={{ margin: "0 4px" }}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>الإعدادات</span>
      </div>
      <Profile email={email} name={name} gender={gender} />
      <CommitDays p={p} initial={commitDays} />
      <ReviewReminders p={p} days={reviewReminderDays} />
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

function CommitDays({ p, initial }: { p: P; initial: number }) {
  const router = useRouter();
  const [days, setDays] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<SettingsState>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className={hl.section} id="commit">
      <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
        أيام الالتزام
      </div>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        الأيام التي {p("تنوي", "تنوين")} فيها تسجيل جلسة (حفظ أو مراجعة أو ربط). يُحسب اليوم ملتزَمًا به إذا {p("سجّلتَ", "سجّلتِ")} فيه
        جلسة، ولا تقطع أيامُ الراحة السلسلةَ. يسري التغيير من اليوم، وتبقى الأيام السابقة على ما كانت عليه.
      </p>
      <WeekdayPicker days={days} onChange={setDays} />
      <div className={hl.muted} style={{ margin: "6px 0 10px" }}>
        الحالي: {daysLabel(saved)}
      </div>
      <Feedback state={state} />
      <button
        type="button"
        className={hl.primaryBtn}
        disabled={pending || days === saved}
        onClick={() =>
          startTransition(async () => {
            const r = await setCommitDaysAction({ days, today: localToday() });
            setState(r);
            if (!r?.error) {
              setSaved(days);
              router.refresh();
            }
          })
        }
      >
        {pending ? "جارٍ الحفظ…" : "حفظ"}
      </button>
    </div>
  );
}

// pre-filled when she turns reminders on (same default as courses)
const DEFAULT_REVIEW_DAYS = 14;

function ReviewReminders({ p, days }: { p: P; days: number | null }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(setReviewRemindersAction, null);
  const [on, setOn] = useState(days !== null);
  return (
    <form className={hl.section} action={action}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
        تذكير المراجعة
      </div>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        يُنبّهك في صفحتك إلى كل سورة {p("أتممتَ", "أتممتِ")} حفظها ولم {p("تراجعها", "تراجعيها")} كاملةً منذ المدة التي {p("تحدّدها", "تحدّدينها")}.
      </p>
      <input type="hidden" name="on" value={on ? "1" : "0"} />
      <label className={styles.confirmRow}>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        تفعيل تذكير المراجعة
      </label>
      {on && (
        <div className={styles.formField}>
          <label className={styles.fieldLabel} htmlFor="review-days">
            عدد الأيام
          </label>
          <input id="review-days" name="days" type="number" min={1} max={90} className={styles.input} defaultValue={days ?? DEFAULT_REVIEW_DAYS} style={{ maxWidth: 120 }} />
        </div>
      )}
      <Feedback state={state} />
      <button type="submit" className={hl.primaryBtn} disabled={pending}>
        {pending ? "جارٍ الحفظ…" : "حفظ"}
      </button>
    </form>
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
            <bdi dir="ltr">{createdAt}</bdi>. إنشاء رمز جديد يُلغي الرمز السابق.
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
        يُحذف الحساب وجميع ما فيه من حفظ ومتابعة نهائيًا، ولا يمكن التراجع عن ذلك.
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
