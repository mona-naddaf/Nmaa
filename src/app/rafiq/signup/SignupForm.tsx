"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import login from "@/app/login/login.module.css";
import styles from "../rafiq.module.css";
import { rafiqSignupAction, type AuthState } from "../actions";
import { RecoveryCodeCard } from "../RecoveryCodeCard";
import { PrivacyNote } from "../PrivacyNote";
import { SignedInNote } from "../SignedInNote";
import { ACCOUNT_LIMITS } from "@/lib/rafiq/rules";

// sendNext: guidance is on (src/lib/guide), so the invite link she came from
// goes with the form (a «العائلة» signup gets the resume card, not the setup
// questions); off: no extra field, as before
export function SignupForm({ signedIn, next = null, sendNext = false }: { signedIn: boolean; next?: string | null; sendNext?: boolean }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(rafiqSignupAction, null);

  return (
    <div className={login.page}>
      <div className={login.wrap}>
        <div className={login.brand}>
          <BrandLogo variant="login" priority />
        </div>
        <div className={login.subtitle}>رفيق الحفظ · إنشاء حساب</div>

        <div className={login.card}>
          {state?.recoveryCode ? (
            <RecoveryCodeCard code={state.recoveryCode} gender={state.gender ?? null} continueHref={next ?? (state.start ? "/rafiq/start" : "/rafiq")}continueLabel={next === "/rafiq/family" ? "متابعة إلى «العائلة»" : next ? "متابعة الانضمام إلى العائلة" : "ابدأ"} />
          ) : signedIn ? (
            <SignedInNote />
          ) : (
            <>
              <form action={formAction}>
                {sendNext && next && <input type="hidden" name="next" value={next} />}
                <div className={login.field}>
                  <label htmlFor="email">البريد الإلكتروني</label>
                  <input id="email" name="email" type="email" placeholder="name@example.com" autoComplete="email" maxLength={ACCOUNT_LIMITS.emailMax} required />
                </div>
                <div className={login.field}>
                  <label htmlFor="password">كلمة المرور</label>
                  <input id="password" name="password" type="password" autoComplete="new-password" minLength={ACCOUNT_LIMITS.passwordMin} required />
                  <div className={styles.hint}>{ACCOUNT_LIMITS.passwordMin} خانات على الأقل</div>
                </div>
                <div className={login.field}>
                  <label htmlFor="confirm">تأكيد كلمة المرور</label>
                  <input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
                </div>
                <div className={login.field}>
                  <label htmlFor="name">الاسم (اختياري)</label>
                  <input id="name" name="name" type="text" maxLength={ACCOUNT_LIMITS.nameMax} autoComplete="given-name" />
                  <div className={styles.hint}>يُستخدم للترحيب بك فقط</div>
                </div>
                <div className={login.field}>
                  <span className={styles.fieldLabel} id="genderLabel">
                    الجنس
                  </span>
                  <div className={styles.genderSwitch} role="radiogroup" aria-labelledby="genderLabel">
                    <label>
                      <input type="radio" name="gender" value="FEMALE" required />
                      أنثى
                    </label>
                    <label>
                      <input type="radio" name="gender" value="MALE" />
                      ذكر
                    </label>
                  </div>
                  <div className={styles.hint}>لمخاطبتك بالصيغة المناسبة</div>
                </div>
                <div className={styles.trap} aria-hidden="true">
                  <label htmlFor="website">موقعك الإلكتروني</label>
                  <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                </div>

                <PrivacyNote />

                {state?.error && <div className={login.err}>{state.error}</div>}
                <button className={login.primaryBtn} type="submit" disabled={pending}>
                  {pending ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب"}
                </button>
              </form>
              <div className={login.linkRow}>
                لديك حساب؟ <Link href={next ? `/rafiq/login?next=${encodeURIComponent(next)}` : "/rafiq/login"}>تسجيل الدخول</Link>
              </div>
              <div className={login.adminToggle}>
                <Link href="/">→ رجوع للصفحة الرئيسية</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
