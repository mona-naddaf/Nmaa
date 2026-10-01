"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import styles from "@/app/login/login.module.css";
import { studentLoginAction, type StudentLoginState } from "../actions";

export function StudentLoginForm() {
  const [state, formAction, pending] = useActionState<StudentLoginState, FormData>(studentLoginAction, null);

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.brand}>
          <BrandLogo variant="login" priority />
        </div>
        <div className={styles.subtitle}>دخول الطالب / الطالبة</div>

        <div className={styles.card}>
          <form action={formAction}>
            <div className={styles.field}>
              <label htmlFor="studentName">الاسم</label>
              <input id="studentName" name="name" type="text" placeholder="كما هو مسجّل في الدورة" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="studentCode">رمز الدخول</label>
              <input
                id="studentCode"
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
