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
      <div style={{ fontWeight: 800, fontSize: 15, textAlign: "center", marginBottom: 4 }}>كود لوحة الإنجاز العامة</div>
      <div style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center", lineHeight: 1.7, marginBottom: 16 }}>
        من يملك هذا الكود يرى لوحة إنجاز الدورة من صفحة <b>/board/login</b> — بأسماء جميع الطلاب الكاملة
        ونقاطهم وصفحاتهم، للعرض فقط دون أي تعديل ودون الوصول لأي صفحة أخرى. مستقل عن كود الدورة للمعلمين.
      </div>
      <AccessCodeBox
        label="كود لوحة الإنجاز"
        emptyText="لا يوجد كود حاليًا — لوحة الإنجاز غير متاحة للعموم."
        createText="إنشاء كود للوحة الإنجاز"
        initialCode={initialCode}
        initialCreatedAt={initialCreatedAt}
        regenerate={regenerateBoardCodeAction}
        revoke={revokeBoardCodeAction}
      />
    </div>
  );
}
