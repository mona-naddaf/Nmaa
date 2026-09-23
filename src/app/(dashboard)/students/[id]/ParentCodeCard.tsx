"use client";

import { useState, useTransition } from "react";
import styles from "./detail.module.css";
import codeStyles from "../../settings/settings.module.css";
import { regenerateParentCodeAction, revokeParentCodeAction } from "./actions";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";

type Confirming = "regenerate" | "revoke" | null;

// Supervisor-only (the page never renders it — or sends the code — for a
// teacher). Destructive actions use an inline second click instead of a
// browser confirm() dialog.
export function ParentCodeCard({
  studentId,
  groupGender,
  initialCode,
  initialCreatedAt,
}: {
  studentId: string;
  groupGender: GroupGender;
  initialCode: string | null;
  initialCreatedAt: string | null;
}) {
  const [code, setCode] = useState(initialCode);
  const [createdAt, setCreatedAt] = useState(initialCreatedAt);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<Confirming>(null);

  const child = pickByGroup(groupGender, { m: "الطالب", f: "الطالبة" });

  function run(action: typeof regenerateParentCodeAction) {
    setError(null);
    setConfirming(null);
    setRunning(action === revokeParentCodeAction ? "revoke" : "regenerate");
    startTransition(async () => {
      let result;
      try {
        result = await action(studentId);
      } catch {
        setError("تعذّر تنفيذ العملية، يُرجى المحاولة مرة أخرى");
        return;
      }
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setCode(result.code);
      setCreatedAt(result.createdAt);
    });
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — the code is still visible to copy by hand
    }
  }

  return (
    <>
      <div className={styles.secTitle}>
        <span className={styles.dot} /> رمز دخول وليّ الأمر
      </div>
      <div className={styles.card}>
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 16 }}>
          يدخل وليّ الأمر من صفحة <b>/parent/login</b> باسم {child} وهذا الرمز، ليرى{" "}
          {pickByGroup(groupGender, {
            m: "صفحاته وحضوره ونقاطه وسجل تسميعه فقط — للعرض دون أي تعديل، ودون أي بيانات عن غيره.",
            f: "صفحاتها وحضورها ونقاطها وسجل تسميعها فقط — للعرض دون أي تعديل، ودون أي بيانات عن غيرها.",
          })}
        </div>

        {code ? (
          <div className={codeStyles.codeBox}>
            <div className={codeStyles.codeLabel}>رمز وليّ الأمر</div>
            <div className={codeStyles.codeVal} dir="ltr">
              {code}
            </div>
            {createdAt && (
              <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 4 }}>
                أُنشئ في {createdAt.slice(0, 10)}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button className={codeStyles.copyBtn} onClick={copy} type="button">
                {copied ? "تم النسخ ✓" : "نسخ الرمز 📋"}
              </button>
              {confirming === "regenerate" ? (
                <button className={codeStyles.copyBtn} onClick={() => run(regenerateParentCodeAction)} type="button" disabled={pending}>
                  تأكيد: الرمز القديم سيتوقف فورًا
                </button>
              ) : (
                <button className={codeStyles.copyBtn} onClick={() => setConfirming("regenerate")} type="button" disabled={pending}>
                  رمز جديد 🔄
                </button>
              )}
              {confirming === "revoke" ? (
                <button className={codeStyles.copyBtn} onClick={() => run(revokeParentCodeAction)} type="button" disabled={pending}>
                  تأكيد إيقاف الوصول
                </button>
              ) : (
                <button className={codeStyles.copyBtn} onClick={() => setConfirming("revoke")} type="button" disabled={pending}>
                  إيقاف الوصول
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 12 }}>
              لا يوجد رمز حاليًا — لا يمكن لأي وليّ أمر الدخول.
            </div>
            <button className={styles.saveBtn} onClick={() => run(regenerateParentCodeAction)} type="button" disabled={pending}>
              {pending && running === "regenerate" ? "جارٍ الإنشاء..." : "إنشاء رمز لوليّ الأمر"}
            </button>
          </div>
        )}

        {error && <div style={{ color: "var(--rose-deep)", fontSize: 12.5, marginTop: 10 }}>{error}</div>}
      </div>
    </>
  );
}
