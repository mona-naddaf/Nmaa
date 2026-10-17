"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import styles from "@/app/login/login.module.css";
import { childLoginAction, type ChildLoginState } from "../actions";

// Before login her gender isn't known, so the wording here stays neutral.
export function ChildLoginForm() {
  const [state, formAction, pending] = useActionState<ChildLoginState, FormData>(childLoginAction, null);

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.brand}>
          <BrandLogo variant="login" priority />
        </div>
        <div className={styles.subtitle}>العائلة · دخول الأطفال 🌱</div>

        <div className={styles.card}>
          <form action={formAction}>
            <div className={styles.field}>
              <label htmlFor="childName">الاسم</label>
              <input id="childName" name="name" type="text" autoComplete="given-name" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="childCode">رمز الدخول</label>
              <input id="childCode" name="code" type="text" placeholder="مثال: KM7Q-4XPD" autoComplete="off" style={{ textTransform: "uppercase" }} required />
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 12px" }}>رمز الدخول تجده عند أهلك.</p>
            {state?.error && <div className={styles.err}>{state.error}</div>}
            <button className={styles.primaryBtn} type="submit" disabled={pending}>
              {pending ? "جارٍ الدخول..." : "دخول"}
            </button>
          </form>
          <div className={styles.adminToggle}>
            <Link href="/">→ رجوع للصفحة الرئيسية</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
