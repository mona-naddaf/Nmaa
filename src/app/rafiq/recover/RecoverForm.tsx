"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import login from "@/app/login/login.module.css";
import styles from "../rafiq.module.css";
import { rafiqRecoverAction, type AuthState } from "../actions";
import { RecoveryCodeCard } from "../RecoveryCodeCard";
import { SignedInNote } from "../SignedInNote";
import { ACCOUNT_LIMITS } from "@/lib/rafiq/rules";

// A new password with the recovery رمز. On success the old رمز is used up
// and a new one is shown once.
export function RecoverForm({ signedIn }: { signedIn: boolean }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(rafiqRecoverAction, null);

  return (
    <div className={login.page}>
      <div className={login.wrap}>
        <div className={login.brand}>
          <BrandLogo variant="login" priority />
        </div>
        <div className={login.subtitle}>رفيق الحفظ · تعيين كلمة مرور جديدة</div>

        <div className={login.card}>
          {state?.recoveryCode ? (
            <>
              <p className={styles.okMsg} style={{ marginTop: 0 }}>
                تم تعيين كلمة المرور الجديدة ✓ وهذا رمز الاستعادة الجديد (لم يعد الرمز السابق صالحًا):
              </p>
              <RecoveryCodeCard code={state.recoveryCode} gender={state.gender ?? null} continueHref="/rafiq" />
            </>
          ) : signedIn ? (
            <SignedInNote />
          ) : (
            <>
              <form action={formAction}>
                <div className={login.field}>
                  <label htmlFor="email">البريد الإلكتروني</label>
                  <input id="email" name="email" type="email" placeholder="name@example.com" autoComplete="email" required />
                </div>
                <div className={login.field}>
                  <label htmlFor="code">رمز الاستعادة</label>
                  <input
                    id="code"
                    name="code"
                    type="text"
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    autoComplete="off"
                    dir="ltr"
                    style={{ textTransform: "uppercase" }}
                    required
                  />
                  <div className={styles.hint}>الرمز الذي ظهر عند إنشاء الحساب أو آخر رمز أُنشئ من الإعدادات</div>
                </div>
                <div className={login.field}>
                  <label htmlFor="password">كلمة المرور الجديدة</label>
                  <input id="password" name="password" type="password" autoComplete="new-password" minLength={ACCOUNT_LIMITS.passwordMin} required />
                </div>
                <div className={login.field}>
                  <label htmlFor="confirm">تأكيد كلمة المرور الجديدة</label>
                  <input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
                </div>
                {state?.error && <div className={login.err}>{state.error}</div>}
                <button className={login.primaryBtn} type="submit" disabled={pending}>
                  {pending ? "جارٍ الحفظ..." : "تعيين كلمة المرور"}
                </button>
              </form>
              <div className={login.linkRow}>
                <Link href="/rafiq/login">→ رجوع لتسجيل الدخول</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
