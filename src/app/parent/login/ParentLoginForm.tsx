"use client";

import { useActionState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import Link from "next/link";
import styles from "@/app/login/login.module.css";
import { parentLoginAction, type ParentLoginState } from "../actions";

export function ParentLoginForm() {
  const [state, formAction, pending] = useActionState<ParentLoginState, FormData>(parentLoginAction, null);

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.brand}>
          <BrandLogo variant="login" priority />
        </div>
        <div className={styles.subtitle}>متابعة وليّ الأمر</div>

        <div className={styles.card}>
          <form action={formAction}>
            <div className={styles.field}>
              <label htmlFor="childName">اسم الطالب / الطالبة</label>
              <input id="childName" name="name" type="text" placeholder="كما هو مسجّل في الدورة" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="parentCode">رمز الدخول</label>
              <input
                id="parentCode"
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
