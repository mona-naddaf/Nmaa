"use client";

import styles from "./detail.module.css";
import { AccessCodeBox } from "@/components/access-code/AccessCodeBox";
import { CopyLink } from "@/components/access-code/CopyLink";
import { regenerateStudentCodeAction, revokeStudentCodeAction } from "./student-code-actions";
import { pickByGroup, studentNounDef, type GroupGender } from "@/lib/text/gender";

// Shown only when student login is on and the viewer may issue codes for
// this student's group (the page checks; the actions check again).
export function StudentCodeCard({
  studentId,
  groupGender: g,
  initialCode,
  initialCreatedAt,
  loginUrl,
}: {
  studentId: string;
  groupGender: GroupGender;
  initialCode: string | null;
  initialCreatedAt: string | null;
  loginUrl: string | null;
}) {
  return (
    <>
      <div className={styles.secTitle}>
        <span className={styles.dot} /> رمز دخول {studentNounDef(g)}
      </div>
      <div className={styles.card}>
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 16 }}>
          {pickByGroup(g, { m: "يدخل", f: "تدخل" })} {studentNounDef(g)} من{" "}
          {loginUrl ? "الرابط أدناه" : <b>/student/login</b>} {pickByGroup(g, { m: "باسمه", f: "باسمها" })} وهذا
          الرمز، {pickByGroup(g, { m: "ليرى صفحته", f: "لترى صفحتها" })} للعرض فقط. هذا الرمز منفصل عن رمز وليّ الأمر.
        </div>
        {loginUrl && <CopyLink url={loginUrl} label={`رابط دخول ${studentNounDef(g)}:`} />}
        <AccessCodeBox
          label={`رمز ${studentNounDef(g)}`}
          emptyText={`لا يوجد رمز حاليًا — لا يمكن ${pickByGroup(g, { m: "للطالب", f: "للطالبة" })} الدخول.`}
          createText={`إنشاء رمز ${pickByGroup(g, { m: "للطالب", f: "للطالبة" })}`}
          initialCode={initialCode}
          initialCreatedAt={initialCreatedAt}
          regenerate={() => regenerateStudentCodeAction(studentId)}
          revoke={() => revokeStudentCodeAction(studentId)}
        />
      </div>
    </>
  );
}
