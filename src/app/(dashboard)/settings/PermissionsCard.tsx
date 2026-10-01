"use client";

import { useTransition } from "react";
import styles from "./settings.module.css";
import {
  setAddStudentsPermissionAction,
  setStudentPermissionAction,
  setVisibilityModeAction,
  setTeacherGroupAssignmentAction,
  type StudentPermissionField,
} from "./actions";
import { pickByPerson, supervisorNoun, type PersonGender } from "@/lib/text/gender";

type AddStudentsPermission = "ADMIN_ONLY" | "ALL_TEACHERS";
type VisibilityMode = "ALL_TEACHERS" | "ASSIGNED";

export function PermissionsCard({
  addStudentsPermission,
  editStudentsPermission,
  archiveStudentsPermission,
  issueStudentCodesPermission,
  studentLoginEnabled,
  adminGender,
  visibilityMode,
  groups,
  teachers,
}: {
  addStudentsPermission: AddStudentsPermission;
  editStudentsPermission: AddStudentsPermission;
  archiveStudentsPermission: AddStudentsPermission;
  issueStudentCodesPermission: AddStudentsPermission;
  studentLoginEnabled: boolean;
  adminGender: PersonGender;
  visibilityMode: VisibilityMode;
  groups: { id: string; name: string }[];
  teachers: { id: string; name: string; groupId: string | null }[];
}) {
  const [, startTransition] = useTransition();
  const supervisorOnly = `ال${supervisorNoun(adminGender)} فقط`;

  const studentPermissionRow = (field: StudentPermissionField, value: AddStudentsPermission, title: string, desc: string) => (
    <div className={styles.settingRow}>
      <div className={styles.settingText}>
        <div className={styles.settingTitle}>{title}</div>
        <div className={styles.settingDesc}>{desc}</div>
      </div>
      <div className={styles.optionPills}>
        <div
          className={`${styles.optionPill} ${value === "ADMIN_ONLY" ? styles.sel : ""}`}
          onClick={() => startTransition(() => setStudentPermissionAction(field, "ADMIN_ONLY"))}
        >
          {supervisorOnly}
        </div>
        <div
          className={`${styles.optionPill} ${value === "ALL_TEACHERS" ? styles.sel : ""}`}
          onClick={() => startTransition(() => setStudentPermissionAction(field, "ALL_TEACHERS"))}
        >
          كل المعلمين
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.card}>
      <div className={styles.settingRow}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>إضافة طلاب جدد</div>
          <div className={styles.settingDesc}>من يملك صلاحية إضافة طالب جديد إلى الدورة؟</div>
        </div>
        <div className={styles.optionPills}>
          <div
            className={`${styles.optionPill} ${addStudentsPermission === "ADMIN_ONLY" ? styles.sel : ""}`}
            onClick={() => startTransition(() => setAddStudentsPermissionAction("ADMIN_ONLY"))}
          >
            {supervisorOnly}
          </div>
          <div
            className={`${styles.optionPill} ${addStudentsPermission === "ALL_TEACHERS" ? styles.sel : ""}`}
            onClick={() => startTransition(() => setAddStudentsPermissionAction("ALL_TEACHERS"))}
          >
            كل المعلمين
          </div>
        </div>
      </div>

      {studentPermissionRow(
        "editStudentsPermission",
        editStudentsPermission,
        "تعديل بيانات الطلاب",
        "من يملك صلاحية تعديل الاسم والعمر والصف والمجموعة؟",
      )}
      {studentPermissionRow(
        "archiveStudentsPermission",
        archiveStudentsPermission,
        "أرشفة الطلاب",
        `من يملك صلاحية أرشفة طالب؟ أما الاستعادة من الأرشيف والحذف النهائي فهما لل${supervisorNoun(adminGender)} ${pickByPerson(adminGender, { m: "وحده", f: "وحدها" })} دائمًا.`,
      )}

      {studentLoginEnabled &&
        studentPermissionRow(
          "issueStudentCodesPermission",
          issueStudentCodesPermission,
          "إصدار رموز الطلاب",
          "من يملك صلاحية إنشاء رموز دخول الطلاب وتجديدها وإلغائها؟ عند اختيار \"كل المعلمين\" يصدر كل معلم رموز طلاب مجموعاته المخصّصة فقط.",
        )}

      <div className={styles.settingRow} style={{ flexDirection: "column", alignItems: "stretch" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div className={styles.settingText}>
            <div className={styles.settingTitle}>رؤية الطلاب</div>
            <div className={styles.settingDesc}>هل يشاهد كل معلم كل الطلاب، أم فقط الطلاب المخصّصين له؟</div>
          </div>
          <div className={styles.optionPills}>
            <div
              className={`${styles.optionPill} ${visibilityMode === "ALL_TEACHERS" ? styles.sel : ""}`}
              onClick={() => startTransition(() => setVisibilityModeAction("ALL_TEACHERS"))}
            >
              كل المعلمين لكل الطلاب
            </div>
            <div
              className={`${styles.optionPill} ${visibilityMode === "ASSIGNED" ? styles.sel : ""}`}
              onClick={() => startTransition(() => setVisibilityModeAction("ASSIGNED"))}
            >
              تخصيص لكل معلم
            </div>
          </div>
        </div>

        {visibilityMode === "ASSIGNED" && (
          <div className={styles.assignBox}>
            <div className={styles.aTitle}>تخصيص المجموعات لكل معلم</div>
            {teachers.length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                لم يسجّل أي معلم دخوله بعد — سيظهر هنا فور تسجيل دخوله لأول مرة
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
