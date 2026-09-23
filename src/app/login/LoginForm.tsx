"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import styles from "./login.module.css";
import { teacherLoginAction, adminLoginAction, adminSignupAction, type ActionState } from "./actions";

type View = "teacher" | "admin";
type AdminMode = "login" | "signup";

export function LoginForm() {
  const [view, setView] = useState<View>("teacher");
  const [adminMode, setAdminMode] = useState<AdminMode>("login");

  const [teacherState, teacherFormAction, teacherPending] = useActionState<ActionState, FormData>(
    teacherLoginAction,
    null,
  );
  const [adminLoginState, adminLoginFormAction, adminLoginPending] = useActionState<ActionState, FormData>(
    adminLoginAction,
    null,
  );
  const [adminSignupState, adminSignupFormAction, adminSignupPending] = useActionState<ActionState, FormData>(
    adminSignupAction,
    null,
  );

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.brand}>
          نماء <span>🌱</span>
        </div>
        <div className={styles.subtitle}>
          {view === "teacher" ? "منصّة متابعة تسميع وحفظ الطلاب" : adminMode === "signup" ? "إنشاء دورة جديدة" : "دخول المشرف"}
        </div>

        {view === "teacher" && (
          <div className={styles.card}>
            <form action={teacherFormAction}>
              <div className={styles.field}>
                <label htmlFor="teacherName">اسمك</label>
                <input id="teacherName" name="name" type="text" placeholder="مثال: سارة أحمد" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="courseCode">كود الدورة</label>
                <input
                  id="courseCode"
                  name="code"
                  type="text"
                  placeholder="مثال: QPXK-7391"
                  style={{ textTransform: "uppercase" }}
                  required
                />
              </div>
              {teacherState?.error && <div className={styles.err}>{teacherState.error}</div>}
              <button className={styles.primaryBtn} type="submit" disabled={teacherPending}>
                {teacherPending ? "جارٍ الدخول..." : "دخول"}
              </button>
            </form>
            <div className={styles.adminToggle}>
              <a onClick={() => setView("admin")}>أنا مشرف الدورة ←</a>
            </div>
            <div className={styles.adminToggle}>
              <Link href="/parent/login">دخول أولياء الأمور ←</Link>
            </div>
          </div>
        )}

        {view === "admin" && (
          <div className={styles.card}>
            <div className={styles.roleSwitch}>
              <button
                type="button"
                className={adminMode === "login" ? styles.active : ""}
                onClick={() => setAdminMode("login")}
              >
                تسجيل الدخول
              </button>
              <button
                type="button"
                className={adminMode === "signup" ? styles.active : ""}
                onClick={() => setAdminMode("signup")}
              >
                إنشاء دورة جديدة
              </button>
            </div>

            {adminMode === "login" ? (
              <form action={adminLoginFormAction}>
                <div className={styles.field}>
                  <label htmlFor="loginEmail">البريد الإلكتروني</label>
                  <input id="loginEmail" name="email" type="email" placeholder="name@example.com" required />
                </div>
                <div className={styles.field}>
                  <label htmlFor="loginPass">كلمة المرور</label>
                  <input id="loginPass" name="password" type="password" placeholder="••••••••" required />
                </div>
                {adminLoginState?.error && <div className={styles.err}>{adminLoginState.error}</div>}
                <button className={styles.primaryBtn} type="submit" disabled={adminLoginPending}>
                  {adminLoginPending ? "جارٍ الدخول..." : "تسجيل الدخول"}
                </button>
              </form>
            ) : (
              <form action={adminSignupFormAction}>
                <div className={styles.field}>
                  <label htmlFor="courseName">اسم الدورة</label>
                  <input id="courseName" name="courseName" type="text" placeholder="مثال: دورة الزهرات — الثلاثاء" required />
                </div>
                <div className={styles.field}>
                  <label htmlFor="signupEmail">البريد الإلكتروني</label>
                  <input id="signupEmail" name="email" type="email" placeholder="name@example.com" required />
                </div>
                <div className={styles.field}>
                  <label htmlFor="signupPass">كلمة المرور</label>
                  <input id="signupPass" name="password" type="password" placeholder="8 خانات على الأقل" required />
                </div>
                {adminSignupState?.error && <div className={styles.err}>{adminSignupState.error}</div>}
                <button className={styles.primaryBtn} type="submit" disabled={adminSignupPending}>
                  {adminSignupPending ? "جارٍ الإنشاء..." : "إنشاء الدورة"}
                </button>
              </form>
            )}

            <div className={styles.adminToggle}>
              <a onClick={() => setView("teacher")}>→ رجوع لتسجيل دخول المعلمين</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
