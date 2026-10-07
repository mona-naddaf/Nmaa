"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import login from "@/app/login/login.module.css";
import { rafiqLoginAction, type AuthState } from "../actions";

export function RafiqLoginForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(rafiqLoginAction, null);

  return (
    <div className={login.page}>
      <div className={login.wrap}>
        <div className={login.brand}>
          <BrandLogo variant="login" priority />
        </div>
        <div className={login.subtitle}>رفيق الحفظ · لمن يتابع حفظه بنفسه</div>

        <div className={login.card}>
          <form action={formAction}>
            <div className={login.field}>
              <label htmlFor="email">البريد الإلكتروني</label>
              <input id="email" name="email" type="email" placeholder="name@example.com" autoComplete="email" required />
            </div>
            <div className={login.field}>
              <label htmlFor="password">كلمة المرور</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {state?.error && <div className={login.err}>{state.error}</div>}
            <button className={login.primaryBtn} type="submit" disabled={pending}>
              {pending ? "جارٍ الدخول..." : "دخول"}
            </button>
          </form>
          <div className={login.linkRow}>
            ليس لديك حساب؟ <Link href="/rafiq/signup">إنشاء حساب</Link>
          </div>
          <div className={login.linkRow} style={{ marginTop: 6 }}>
            <Link href="/rafiq/recover">نسيتُ كلمة المرور</Link>
          </div>
          <div className={login.adminToggle}>
            <Link href="/">→ رجوع للصفحة الرئيسية</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
