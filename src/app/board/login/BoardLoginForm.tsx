"use client";

import { useActionState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import Link from "next/link";
import styles from "@/app/login/login.module.css";
import { boardLoginAction, type BoardLoginState } from "../actions";

export function BoardLoginForm() {
  const [state, formAction, pending] = useActionState<BoardLoginState, FormData>(boardLoginAction, null);

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.brand}>
          <BrandLogo variant="login" priority />
        </div>
        <div className={styles.subtitle}>لوحة إنجاز الدورة</div>

        <div className={styles.card}>
          <form action={formAction}>
            <div className={styles.field}>
              <label htmlFor="boardCode">رمز لوحة الإنجاز</label>
              <input
                id="boardCode"
                name="code"
                type="text"
                placeholder="مثال: KM7Q-4XPD"
                autoComplete="off"
                style={{ textTransform: "uppercase" }}
                required
              />
            </div>
            {state?.error && <div className={styles.err}>{state.error}</div>}
            <button className={styles.primaryBtn} type="submit" disabled={pending}>
              {pending ? "جارٍ الدخول..." : "عرض لوحة الإنجاز"}
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
