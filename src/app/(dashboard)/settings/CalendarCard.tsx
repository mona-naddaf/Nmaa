"use client";

import { useState, useTransition } from "react";
import styles from "./settings.module.css";
import {
  setCalendarBannerEnabledAction,
  setCalendarEditPermissionAction,
  setCalendarEnabledAction,
} from "./actions";
import { pickByPerson, supervisorNoun, type PersonGender } from "@/lib/text/gender";

type EditPermission = "ADMIN_ONLY" | "ALL_TEACHERS";

export function CalendarCard({
  enabled,
  bannerEnabled,
  editPermission,
  adminGender,
}: {
  enabled: boolean;
  bannerEnabled: boolean;
  editPermission: EditPermission;
  adminGender: PersonGender;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // the banner and the permission only mean something while the calendar is on
  const dependent = enabled ? undefined : { opacity: 0.5, pointerEvents: "none" as const };

  function run(action: () => Promise<{ error?: string } | void>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <div className={styles.settingRow}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>التقويم الهجري</div>
          <div className={styles.settingDesc}>
            صفحة &quot;التقويم&quot; للمعلمين والإشراف: المناسبات الإسلامية بالتاريخين الهجري والميلادي مع العدّ
            التنازلي، وفعاليات الدورة القادمة والسابقة. لا تظهر لأولياء الأمور ولا في لوحة الإنجاز العامة.
          </div>
        </div>
        <div className={styles.optionPills}>
          <div
            className={`${styles.optionPill} ${enabled ? styles.sel : ""}`}
            onClick={() => !enabled && !pending && run(() => setCalendarEnabledAction(true))}
          >
            مفعّل
          </div>
          <div
            className={`${styles.optionPill} ${!enabled ? styles.sel : ""}`}
            onClick={() => enabled && !pending && run(() => setCalendarEnabledAction(false))}
          >
            غير مفعّل
          </div>
        </div>
      </div>

      <div className={styles.settingRow} style={dependent} aria-disabled={!enabled}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>شريط العدّ التنازلي في الصفحة الرئيسية</div>
          <div className={styles.settingDesc}>
            شريط صغير أعلى قائمة الطلاب يعرض أقرب مناسبة أو فعالية قادمة وعدد الأيام المتبقية عليها.
            {!enabled && " (يتاح بعد تفعيل التقويم)"}
          </div>
        </div>
        <div className={styles.optionPills}>
          <div
            className={`${styles.optionPill} ${bannerEnabled ? styles.sel : ""}`}
            onClick={() => !bannerEnabled && !pending && run(() => setCalendarBannerEnabledAction(true))}
          >
            مفعّل
          </div>
          <div
            className={`${styles.optionPill} ${!bannerEnabled ? styles.sel : ""}`}
            onClick={() => bannerEnabled && !pending && run(() => setCalendarBannerEnabledAction(false))}
          >
            غير مفعّل
          </div>
        </div>
      </div>

      <div className={styles.settingRow} style={dependent} aria-disabled={!enabled}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>إدارة الفعاليات والمناسبات</div>
          <div className={styles.settingDesc}>
            من يملك صلاحية إضافة الفعاليات وتعديلها وحذفها، وتفعيل المناسبات الاختيارية؟ عند اختيار &quot;كل
            المعلمين&quot; يعدّل كل معلم الفعاليات التي أضافها فقط. أما تعديل مواعيد المناسبات بحسب رؤية الهلال
            فيبقى لل{supervisorNoun(adminGender)} {pickByPerson(adminGender, { m: "وحده", f: "وحدها" })}.
          </div>
        </div>
        <div className={styles.optionPills}>
          <div
            className={`${styles.optionPill} ${editPermission === "ADMIN_ONLY" ? styles.sel : ""}`}
            onClick={() => !pending && run(() => setCalendarEditPermissionAction("ADMIN_ONLY"))}
          >
            ال{supervisorNoun(adminGender)} فقط
          </div>
          <div
            className={`${styles.optionPill} ${editPermission === "ALL_TEACHERS" ? styles.sel : ""}`}
            onClick={() => !pending && run(() => setCalendarEditPermissionAction("ALL_TEACHERS"))}
          >
            كل المعلمين
          </div>
        </div>
      </div>
      {error && <div className={styles.err}>{error}</div>}
    </>
  );
}
