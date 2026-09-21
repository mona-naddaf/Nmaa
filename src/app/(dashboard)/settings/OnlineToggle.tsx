"use client";

import { useTransition } from "react";
import styles from "./settings.module.css";
import { setOnlineRecitationEnabledAction } from "./actions";

export function OnlineToggle({ enabled }: { enabled: boolean }) {
  const [, startTransition] = useTransition();

  return (
    <div className={styles.settingRow} style={{ borderBottom: "none" }}>
      <div className={styles.settingText}>
        <div className={styles.settingTitle}>التسميع الأونلاين</div>
        <div className={styles.settingDesc}>
          السماح بتسجيل تسميع تمّ عن بُعد (اتصال/مكالمة)، بنفس نظام السورة والآيات، مع تمييزه عن التسميع
          الحضوري وإضافة عدّاد خاص به لكل طالب.
        </div>
      </div>
      <div className={styles.optionPills}>
        <div
          className={`${styles.optionPill} ${enabled ? styles.sel : ""}`}
          onClick={() => startTransition(() => setOnlineRecitationEnabledAction(true))}
        >
          مفعّل
        </div>
        <div
          className={`${styles.optionPill} ${!enabled ? styles.sel : ""}`}
          onClick={() => startTransition(() => setOnlineRecitationEnabledAction(false))}
        >
          غير مفعّل
        </div>
      </div>
    </div>
  );
}
