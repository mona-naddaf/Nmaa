"use client";

import { useState } from "react";
import styles from "./settings.module.css";
import { imperative, type PersonGender } from "@/lib/text/gender";

export function CourseCodeBox({
  courseName,
  code,
  adminGender,
}: {
  courseName: string;
  code: string;
  adminGender: PersonGender;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — nothing we can do silently
    }
  }

  return (
    <div className={styles.card}>
      <div style={{ fontWeight: 800, fontSize: 17, textAlign: "center", marginBottom: 4 }}>{courseName}</div>
      <div style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center", marginBottom: 20 }}>
        {imperative(adminGender, { m: "شارك", f: "شاركي" })} هذا الكود مع معلمي دورتك ليتمكّنوا من الدخول
      </div>
      <div className={styles.codeBox}>
        <div className={styles.codeLabel}>كود الدورة</div>
        <div className={styles.codeVal}>{code}</div>
        <div>
          <button className={styles.copyBtn} onClick={copy} type="button">
            {copied ? "تم النسخ ✓" : "نسخ الكود 📋"}
          </button>
        </div>
      </div>
    </div>
  );
}
