"use client";

import { useState, useTransition } from "react";
import styles from "./access-code.module.css";

export type AccessCodeResult = { error: string } | { code: string | null; createdAt: string | null };

type Op = "regenerate" | "revoke";

/**
 * Show / copy / create / replace / revoke UI for a revocable access code
 * (per-student parent code, course-wide board code). Replacing and revoking
 * need an inline second click rather than a browser confirm() dialog.
 */
export function AccessCodeBox({
  label,
  emptyText,
  createText,
  initialCode,
  initialCreatedAt,
  regenerate,
  revoke,
}: {
  label: string;
  emptyText: string;
  createText: string;
  initialCode: string | null;
  initialCreatedAt: string | null;
  regenerate: () => Promise<AccessCodeResult>;
  revoke: () => Promise<AccessCodeResult>;
}) {
  const [code, setCode] = useState(initialCode);
  const [createdAt, setCreatedAt] = useState(initialCreatedAt);
  const [confirming, setConfirming] = useState<Op | null>(null);
  const [running, setRunning] = useState<Op | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(op: Op) {
    setError(null);
    setConfirming(null);
    setRunning(op);
    startTransition(async () => {
      let result: AccessCodeResult;
      try {
        result = await (op === "regenerate" ? regenerate() : revoke());
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
      {code ? (
        <div className={styles.codeBox}>
          <div className={styles.codeLabel}>{label}</div>
          <div className={styles.codeVal} dir="ltr">
            {code}
          </div>
          {createdAt && <div className={styles.created}>أُنشئ في {createdAt.slice(0, 10)}</div>}
          <div className={styles.actions}>
            <button className={styles.btn} onClick={copy} type="button">
              {copied ? "تم النسخ ✓" : "نسخ الرمز 📋"}
            </button>
            {confirming === "regenerate" ? (
              <button className={styles.btn} onClick={() => run("regenerate")} type="button" disabled={pending}>
                تأكيد: الرمز القديم سيتوقف فورًا
              </button>
            ) : (
              <button className={styles.btn} onClick={() => setConfirming("regenerate")} type="button" disabled={pending}>
                رمز جديد 🔄
              </button>
            )}
            {confirming === "revoke" ? (
              <button className={styles.btn} onClick={() => run("revoke")} type="button" disabled={pending}>
                تأكيد إيقاف الوصول
              </button>
            ) : (
              <button className={styles.btn} onClick={() => setConfirming("revoke")} type="button" disabled={pending}>
                إيقاف الوصول
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyText}>{emptyText}</div>
          <button className={styles.createBtn} onClick={() => run("regenerate")} type="button" disabled={pending}>
            {pending && running === "regenerate" ? "جارٍ الإنشاء..." : createText}
          </button>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
    </>
  );
}
