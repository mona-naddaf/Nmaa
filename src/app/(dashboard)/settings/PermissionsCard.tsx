"use client";

import { useTransition } from "react";
import styles from "./settings.module.css";
import {
  setAddStudentsPermissionAction,
  setVisibilityModeAction,
  setTeacherGroupAssignmentAction,
} from "./actions";

type AddStudentsPermission = "ADMIN_ONLY" | "ALL_TEACHERS";
type VisibilityMode = "ALL_TEACHERS" | "ASSIGNED";

export function PermissionsCard({
  addStudentsPermission,
  visibilityMode,
  groups,
  teachers,
}: {
  addStudentsPermission: AddStudentsPermission;
  visibilityMode: VisibilityMode;
  groups: { id: string; name: string }[];
  teachers: { id: string; name: string; groupId: string | null }[];
}) {
  const [, startTransition] = useTransition();

  return (
    <div className={styles.card}>
      <div className={styles.settingRow}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>إضافة طالبات جديدات</div>
          <div className={styles.settingDesc}>من يملك صلاحية إضافة طالبة جديدة إلى الدورة؟</div>
        </div>
        <div className={styles.optionPills}>
          <div
            className={`${styles.optionPill} ${addStudentsPermission === "ADMIN_ONLY" ? styles.sel : ""}`}
            onClick={() => startTransition(() => setAddStudentsPermissionAction("ADMIN_ONLY"))}
          >
            المديرة فقط
          </div>
          <div
            className={`${styles.optionPill} ${addStudentsPermission === "ALL_TEACHERS" ? styles.sel : ""}`}
            onClick={() => startTransition(() => setAddStudentsPermissionAction("ALL_TEACHERS"))}
          >
            كل المعلمات
          </div>
        </div>
      </div>

      <div className={styles.settingRow} style={{ flexDirection: "column", alignItems: "stretch" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div className={styles.settingText}>
            <div className={styles.settingTitle}>رؤية الطالبات</div>
            <div className={styles.settingDesc}>هل تشاهد كل معلمة كل الطالبات، أم فقط الطالبات المخصّصات لها؟</div>
          </div>
          <div className={styles.optionPills}>
            <div
              className={`${styles.optionPill} ${visibilityMode === "ALL_TEACHERS" ? styles.sel : ""}`}
              onClick={() => startTransition(() => setVisibilityModeAction("ALL_TEACHERS"))}
            >
              كل المعلمات لكل البنات
            </div>
            <div
              className={`${styles.optionPill} ${visibilityMode === "ASSIGNED" ? styles.sel : ""}`}
              onClick={() => startTransition(() => setVisibilityModeAction("ASSIGNED"))}
            >
              تخصيص لكل معلمة
            </div>
          </div>
        </div>

        {visibilityMode === "ASSIGNED" && (
          <div className={styles.assignBox}>
            <div className={styles.aTitle}>تخصيص المجموعات لكل معلمة</div>
            {teachers.length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                لم تسجّل أي معلمة دخولها بعد — ستظهر هنا فور تسجيل دخولها لأول مرة
              </div>
            )}
            {teachers.map((t) => (
              <div className={styles.assignRow} key={t.id}>
                <span>{t.name}</span>
                <select
                  defaultValue={t.groupId ?? ""}
                  onChange={(e) =>
                    startTransition(() => setTeacherGroupAssignmentAction(t.id, e.target.value || null))
                  }
                >
                  <option value="">كل المجموعات</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
