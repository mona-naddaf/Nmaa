"use client";

import { AccessCodeBox } from "@/components/access-code/AccessCodeBox";
import { CopyLink } from "@/components/access-code/CopyLink";
import { regenerateBoardCodeAction, revokeBoardCodeAction } from "./actions";

export function BoardCodeCard({
  initialCode,
  initialCreatedAt,
  loginUrl,
}: {
  initialCode: string | null;
  initialCreatedAt: string | null;
  // full board login link on the domain in use; null if unknown
  loginUrl: string | null;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center", lineHeight: 1.7, marginBottom: 16 }}>
        من يملك هذا الرمز يرى لوحة إنجاز الدورة من {loginUrl ? "الرابط أدناه" : <b>/board/login</b>} — بأسماء جميع الطلاب الكاملة
        ونقاطهم وصفحاتهم، للعرض فقط دون أي تعديل ودون الوصول لأي صفحة أخرى. مستقل عن رمز الدورة للمعلمين.
      </div>
      {loginUrl && <CopyLink url={loginUrl} label="رابط لوحة الإنجاز:" />}
      <AccessCodeBox
        label="رمز لوحة الإنجاز"
        emptyText="لا يوجد رمز حاليًا — لوحة الإنجاز غير متاحة للعموم."
        createText="إنشاء رمز للوحة الإنجاز"
        initialCode={initialCode}
        initialCreatedAt={initialCreatedAt}
        regenerate={regenerateBoardCodeAction}
        revoke={revokeBoardCodeAction}
      />
    </div>
  );
}
