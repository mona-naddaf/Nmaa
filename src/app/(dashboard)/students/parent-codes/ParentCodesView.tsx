"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import styles from "./parent-codes.module.css";
import { generateMissingParentCodesAction } from "./actions";
import type { ParentCodeRow } from "@/lib/parent/codes";
import { imperative, pickByGroup, studentNounDef, type GroupGender, type PersonGender } from "@/lib/text/gender";

// Arabic number agreement: رمز واحد، رمزان، 3–10 رموز، 11+ رمزًا
function codesText(n: number): string {
  if (n === 1) return "رمز واحد";
  if (n === 2) return "رمزان";
  return `${n} ${n <= 10 ? "رموز" : "رمزًا"}`;
}

export function ParentCodesView({
  rows,
  courseGender: g,
  viewerGender,
}: {
  rows: ParentCodeRow[];
  courseGender: GroupGender;
  viewerGender: PersonGender;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const missing = rows.filter((r) => r.status === "none").length;
  const revoked = rows.filter((r) => r.status === "revoked");

  function generate() {
    setMessage(null);
    startTransition(async () => {
      const result = await generateMissingParentCodesAction();
      setMessage("error" in result ? { ok: false, text: result.error } : { ok: true, text: result.created === 0 ? "لا يوجد من يحتاج رمزًا جديدًا" : `تم إنشاء ${codesText(result.created)} ✓` });
    });
  }

  return (
    <div>
      <Link href="/students" className={styles.back}>
        → رجوع للقائمة
      </Link>

      <div className={styles.card}>
        <div className={styles.stats}>
          <span>
            <b>{rows.length - missing - revoked.length}</b> {pickByGroup(g, { m: "لديهم رمز", f: "لديهن رمز" })}
          </span>
          <span>
            <b>{missing}</b> بدون رمز
          </span>
          {revoked.length > 0 && (
            <span>
              <b>{revoked.length}</b> {pickByGroup(g, { m: "أُلغي رمزهم", f: "أُلغي رمزهن" })}
            </span>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={generate} disabled={pending || missing === 0}>
            {pending
              ? "جارٍ الإنشاء..."
              : pickByGroup(g, {
                  m: "إنشاء أكواد لكل الطلاب اللي ما إلهم كود",
                  f: "إنشاء أكواد لكل الطالبات اللي ما إلهن كود",
                })}
          </button>
          <a className={styles.secondary} href="/parent-codes/print" target="_blank" rel="noopener">
            🖨️ طباعة القائمة
          </a>
        </div>

        {message && <div className={message.ok ? styles.ok : styles.err}>{message.text}</div>}

        {revoked.length > 0 && (
          <p className={styles.note}>
            لا تُنشأ أكواد تلقائيًا لمن أُلغي {pickByGroup(g, { m: "رمزهم", f: "رمزهن" })} سابقًا (
            {revoked.map((r) => r.name).join("، ")}) — لإعادة إصدار رمز {pickByGroup(g, { m: "لأحدهم", f: "لإحداهن" })}{" "}
            {imperative(viewerGender, { m: "افتح", f: "افتحي" })} {pickByGroup(g, { m: "صفحته", f: "صفحتها" })}.
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <div className={styles.card}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{studentNounDef(g)}</th>
                <th>المجموعة</th>
                <th>رمز وليّ الأمر</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/students/${r.id}`}>{r.name}</Link>
                  </td>
                  <td>{r.groupName}</td>
                  <td className={r.code ? styles.code : styles.noCode}>
                    {r.code ?? (r.status === "revoked" ? "أُلغي" : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
