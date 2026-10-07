"use client";

import { useState } from "react";
import Link from "next/link";
import login from "@/app/login/login.module.css";
import styles from "./rafiq.module.css";
import { pickByPerson, type PersonGender } from "@/lib/text/gender";

// The recovery رمز, shown exactly once (after sign-up, a recovery, or a
// regeneration in settings). She must tick that she saved it before going on.
export function RecoveryCodeCard({
  code,
  gender,
  continueHref,
  continueLabel = "متابعة",
}: {
  code: string;
  gender: PersonGender;
  continueHref?: string;
  continueLabel?: string;
}) {
  const p = (m: string, f: string) => pickByPerson(gender, { m, f });
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <div className={login.codeBox}>
        <div className={login.codeLabel}>رمز الاستعادة</div>
        <div className={styles.codeVal}>{code}</div>
        <button
          type="button"
          className={login.copyBtn}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "تم النسخ ✓" : "نسخ الرمز"}
        </button>
      </div>
      <p className={styles.codeNote}>
        {p("احتفظ", "احتفظي")} بهذا الرمز في مكان آمن، فهو الطريقة الوحيدة لتعيين كلمة مرور جديدة إن{" "}
        {p("نسيتَها", "نسيتِها")}. <b>لن يظهر مرة أخرى</b>، {p("ويمكنك", "ويمكنكِ")} إنشاء رمز جديد من الإعدادات في أي وقت.
      </p>
      {continueHref && (
        <>
          <label className={styles.confirmRow}>
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            حفظتُ رمز الاستعادة في مكان آمن
          </label>
          {saved ? (
            <Link href={continueHref} className={login.primaryBtn} style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
              {continueLabel}
            </Link>
          ) : (
            <button type="button" className={login.primaryBtn} disabled>
              {continueLabel}
            </button>
          )}
        </>
      )}
    </div>
  );
}
