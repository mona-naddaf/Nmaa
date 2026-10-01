"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import hl from "@/components/home-log/home-log.module.css";
import styles from "@/components/student-work/work.module.css";
import { AssignmentForm, type AssignmentFormInitial, type PickGroup } from "@/components/student-work/AssignmentForm";
import { segmentTitle } from "@/components/home-log/TargetProgress";
import { gregorianLabel } from "@/lib/calendar/hijri";
import { ASSIGNMENT_TYPE_ICON, ASSIGNMENT_TYPE_LABEL } from "@/lib/assignments/rules";
import type { StaffAssignment } from "@/lib/assignments/data";
import { pickByGroup, pickByPerson, type GroupGender, type PersonGender } from "@/lib/text/gender";
import { createAssignmentAction, deleteAssignmentAction, updateAssignmentAction } from "./actions";

type FormState = { kind: "new" } | { kind: "edit"; a: StaffAssignment } | null;

export function AssignmentsView({
  assignments,
  groups,
  groupFilter,
  gender,
  homeLogEnabled,
  viewerGender,
}: {
  assignments: StaffAssignment[];
  groups: PickGroup[];
  groupFilter: string | null;
  // wording about students across the groups she sees
  gender: GroupGender;
  homeLogEnabled: boolean;
  viewerGender: PersonGender;
}) {
  const [form, setForm] = useState<FormState>(null);
  const filterGroup = groups.find((g) => g.id === groupFilter);

  const blank: AssignmentFormInitial = {
    title: "",
    description: null,
    type: homeLogEnabled ? "QURAN" : "QUESTION",
    dueDate: null,
    surahNumber: null,
    fromAyah: null,
    toAyah: null,
    target: { kind: "GROUP", groupId: filterGroup?.id ?? groups[0]?.id ?? "" },
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <h1 className={styles.pageTitle}>الواجبات</h1>
        {!form && groups.length > 0 && (
          <button type="button" className={hl.primaryBtn} onClick={() => setForm({ kind: "new" })}>
            + واجب جديد
          </button>
        )}
      </div>

      {groups.length > 1 && (
        <div className={styles.pills} style={{ marginBottom: 14 }} role="navigation" aria-label="تصفية حسب المجموعة">
          <Link href="/assignments" className={`${styles.pill} ${!groupFilter ? styles.sel : ""}`}>
            كل المجموعات
          </Link>
          {groups.map((g) => (
            <Link key={g.id} href={`/assignments?group=${g.id}`} className={`${styles.pill} ${groupFilter === g.id ? styles.sel : ""}`}>
              {g.name}
            </Link>
          ))}
        </div>
      )}

      {groups.length === 0 && (
        <div className={hl.section}>
          <div className={hl.empty}>لا توجد مجموعات {pickByPerson(viewerGender, { m: "مسندة إليك", f: "مسندة إليكِ" })} بعد.</div>
        </div>
      )}

      {form && (
        <AssignmentForm
          key={form.kind === "edit" ? form.a.id : "new"}
          heading={form.kind === "new" ? "واجب جديد" : "تعديل الواجب"}
          initial={form.kind === "new" ? blank : toInitial(form.a)}
          groups={groups}
          gender={gender}
          homeLogEnabled={homeLogEnabled}
          onCancel={() => setForm(null)}
          onSubmit={async (input, target) => {
            const r = form.kind === "new" ? await createAssignmentAction(input, target) : await updateAssignmentAction(form.a.id, input, target);
            if (!r.error) setForm(null);
            return r;
          }}
        />
      )}

      {assignments.length === 0 ? (
        groups.length > 0 && (
          <div className={hl.section}>
            <div className={hl.empty}>لا توجد واجبات{filterGroup ? ` لمجموعة ${filterGroup.name}` : ""} بعد.</div>
          </div>
        )
      ) : (
        <div className={styles.list}>
          {assignments.map((a) => (
            <AssignmentCard key={a.id} a={a} onEdit={() => setForm({ kind: "edit", a })} editing={form?.kind === "edit" && form.a.id === a.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function toInitial(a: StaffAssignment): AssignmentFormInitial {
  return {
    title: a.title,
    description: a.description,
    type: a.type,
    dueDate: a.dueDate,
    surahNumber: a.range?.surahNumber ?? null,
    fromAyah: a.range?.fromAyah ?? null,
    toAyah: a.range?.toAyah ?? null,
    target: a.target.kind === "GROUP" ? { kind: "GROUP", groupId: a.target.groupId } : { kind: "STUDENTS", studentIds: a.students.map((s) => s.id) },
  };
}

function AssignmentCard({ a, onEdit, editing }: { a: StaffAssignment; onEdit: () => void; editing: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const p = (m: string, f: string) => pickByGroup(a.gender, { m, f });
  const done = a.students.filter((s) => s.done);
  const notDone = a.students.filter((s) => !s.done);
  const showGroup = a.target.kind === "STUDENTS" && new Set(a.students.map((s) => s.groupName)).size > 1;
  const nameOf = (s: (typeof a.students)[number]) => (showGroup ? `${s.name} (${s.groupName})` : s.name);

  function remove() {
    setError(null);
    startTransition(async () => {
      const r = await deleteAssignmentAction(a.id);
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className={styles.card} style={editing ? { borderColor: "var(--rose-deep)" } : undefined}>
      <div className={styles.cardTitle}>
        {ASSIGNMENT_TYPE_ICON[a.type]} {a.title}
      </div>
      <div className={styles.meta}>
        <span className={styles.tag}>{ASSIGNMENT_TYPE_LABEL[a.type]}</span>
        <span>{a.target.kind === "GROUP" ? `المجموعة: ${a.target.groupName}` : `${p("طلاب محدّدون", "طالبات محدّدات")} (${a.students.length})`}</span>
        {a.range && <span>{segmentTitle(a.range)}</span>}
        {a.dueDate && <span>التسليم: {gregorianLabel(a.dueDate)}</span>}
        <span>أنشأه: {a.creatorName ?? "الإشراف"}</span>
      </div>
      {a.description && <div className={styles.desc}>{a.description}</div>}

      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, minHeight: 32 }}>
          {p("أنجزه", "أنجزته")} {done.length} من {a.students.length}
        </summary>
        <div className={styles.who}>
          <div className={styles.whoBox}>
            <b>✓ {p("علّموا الإنجاز", "علّمن الإنجاز")}</b>
            {done.length ? done.map(nameOf).join("، ") : "—"}
          </div>
          <div className={styles.whoBox}>
            <b>لم يُعلَّم بعد</b>
            {notDone.length ? notDone.map(nameOf).join("، ") : "—"}
          </div>
        </div>
      </details>

      {a.canEdit && (
        <div className={styles.cardActions}>
          {!confirming ? (
            <>
              <button type="button" className={hl.ghostBtn} onClick={onEdit} disabled={pending}>
                تعديل
              </button>
              <button type="button" className={styles.dangerBtn} onClick={() => setConfirming(true)} disabled={pending}>
                حذف
              </button>
            </>
          ) : (
            <>
              <span className={hl.muted} style={{ alignSelf: "center" }}>
                {a.type === "QURAN" ? "تبقى المقاطع التي بدأ التدريب عليها. " : ""}حذف هذا الواجب؟
              </span>
              <button type="button" className={styles.dangerBtn} onClick={remove} disabled={pending}>
                {pending ? "جارٍ الحذف…" : "نعم، حذف"}
              </button>
              <button type="button" className={hl.ghostBtn} onClick={() => setConfirming(false)} disabled={pending}>
                إلغاء
              </button>
            </>
          )}
        </div>
      )}
      {error && <div className={hl.err}>{error}</div>}
    </div>
  );
}
