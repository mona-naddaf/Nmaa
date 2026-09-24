"use client";

import styles from "./detail.module.css";
import { AccessCodeBox } from "@/components/access-code/AccessCodeBox";
import { regenerateParentCodeAction, revokeParentCodeAction } from "./actions";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";

// Supervisor-only (the page never renders it — or sends the code — for a
// teacher).
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
  const child = pickByGroup(groupGender, { m: "الطالب", f: "الطالبة" });

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
        <AccessCodeBox
          label="رمز وليّ الأمر"
          emptyText="لا يوجد رمز حاليًا — لا يمكن لأي وليّ أمر الدخول."
          createText="إنشاء رمز لوليّ الأمر"
          initialCode={initialCode}
          initialCreatedAt={initialCreatedAt}
          regenerate={() => regenerateParentCodeAction(studentId)}
          revoke={() => revokeParentCodeAction(studentId)}
        />
      </div>
    </>
  );
}
