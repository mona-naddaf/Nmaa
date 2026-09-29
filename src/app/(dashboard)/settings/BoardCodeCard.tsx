"use client";

import styles from "./settings.module.css";
import { AccessCodeBox } from "@/components/access-code/AccessCodeBox";
import { regenerateBoardCodeAction, revokeBoardCodeAction } from "./actions";

export function BoardCodeCard({
  initialCode,
  initialCreatedAt,
}: {
  initialCode: string | null;
  initialCreatedAt: string | null;
}) {
  return (
    <div className={styles.card}>
      <div style={{ fontWeight: 800, fontSize: 15, textAlign: "center", marginBottom: 4 }}>رمز لوحة الإنجاز العامة</div>
      <div style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center", lineHeight: 1.7, marginBottom: 16 }}>
        من يملك هذا الرمز يرى لوحة إنجاز الدورة من صفحة <b>/board/login</b> — بأسماء جميع الطلاب الكاملة
        ونقاطهم وصفحاتهم، للعرض فقط دون أي تعديل ودون الوصول لأي صفحة أخرى. مستقل عن رمز الدورة للمعلمين.
      </div>
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
