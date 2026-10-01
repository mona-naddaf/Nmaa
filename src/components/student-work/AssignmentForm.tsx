"use client";

import { useMemo, useState, useTransition } from "react";
import hl from "@/components/home-log/home-log.module.css";
import styles from "./work.module.css";
import { AYAH_COUNT, SURAHS } from "@/lib/quran-data";
import { HOME_LIMITS } from "@/lib/home-log/rules";
import {
  ASSIGNMENT_LIMITS,
  ASSIGNMENT_TYPE_ICON,
  ASSIGNMENT_TYPE_LABEL,
  ASSIGNMENT_TYPES,
  QURAN_NEEDS_HOME_LOG,
  type AssignmentInput,
  type AssignmentType,
} from "@/lib/assignments/rules";
import type { AssignmentTargetInput } from "@/app/(dashboard)/assignments/actions";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";

export interface PickGroup {
  id: string;
  name: string;
  gender: GroupGender;
  students: { id: string; name: string }[];
}

export interface AssignmentFormInitial extends AssignmentInput {
  target: AssignmentTargetInput;
}

const range = (lo: number, hi: number) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);

/** New/edit assignment: fields, then whom it's for (a whole group or picked students). */
export function AssignmentForm({
  heading,
  initial,
  groups,
  gender: g,
  homeLogEnabled,
  onSubmit,
  onCancel,
}: {
  heading: string;
  initial: AssignmentFormInitial;
  groups: PickGroup[];
  // wording about students across the groups she sees
  gender: GroupGender;
  homeLogEnabled: boolean;
  onSubmit: (input: AssignmentInput, target: AssignmentTargetInput) => Promise<{ error?: string }>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [type, setType] = useState<AssignmentType>(initial.type);
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const [surah, setSurah] = useState(initial.surahNumber ?? 1);
  const [from, setFrom] = useState(initial.fromAyah ?? 1);
  const [to, setTo] = useState(initial.toAyah ?? Math.min(AYAH_COUNT[1], 7));
  const [targetKind, setTargetKind] = useState<"GROUP" | "STUDENTS">(initial.target.kind);
  const [groupId, setGroupId] = useState(initial.target.kind === "GROUP" ? initial.target.groupId : (groups[0]?.id ?? ""));
  const [picked, setPicked] = useState<Set<string>>(new Set(initial.target.kind === "STUDENTS" ? initial.target.studentIds : []));
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const count = AYAH_COUNT[surah] ?? 1;
  const p = (m: string, f: string) => pickByGroup(g, { m, f });

  const filtered = useMemo(() => {
    const q = search.trim();
    return groups
      .map((gr) => ({ ...gr, students: q ? gr.students.filter((s) => s.name.includes(q)) : gr.students }))
      .filter((gr) => gr.students.length > 0);
  }, [groups, search]);

  function changeSurah(n: number) {
    setSurah(n);
    setFrom(1);
    setTo(Math.min(AYAH_COUNT[n] ?? 1, 10));
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("يُرجى كتابة عنوان الواجب");
    if (targetKind === "STUDENTS" && picked.size === 0) return setError(p("يُرجى اختيار طالب واحد على الأقل", "يُرجى اختيار طالبة واحدة على الأقل"));
    const quran = type === "QURAN";
    const input: AssignmentInput = {
      title,
      description: description || null,
      type,
      dueDate: dueDate || null,
      surahNumber: quran ? surah : null,
      fromAyah: quran ? from : null,
      toAyah: quran ? to : null,
    };
    const target: AssignmentTargetInput = targetKind === "GROUP" ? { kind: "GROUP", groupId } : { kind: "STUDENTS", studentIds: [...picked] };
    startTransition(async () => {
      const r = await onSubmit(input, target);
      if (r.error) setError(r.error);
    });
  }

  return (
    <form className={hl.section} onSubmit={submit}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 12px" }}>
        {heading}
      </div>

      <div className={styles.field}>
        <label htmlFor="as-title">العنوان</label>
        <input
          id="as-title"
          className={styles.input}
          value={title}
          maxLength={ASSIGNMENT_LIMITS.titleMax}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثال: مراجعة سورة الملك"
          autoFocus
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>النوع</span>
        <div className={styles.pills} role="group" aria-label="نوع الواجب">
          {ASSIGNMENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.pill} ${type === t ? styles.sel : ""}`}
              onClick={() => setType(t)}
              disabled={t === "QURAN" && !homeLogEnabled}
              aria-pressed={type === t}
            >
              {ASSIGNMENT_TYPE_ICON[t]} {ASSIGNMENT_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        {!homeLogEnabled && <div className={styles.hint}>{QURAN_NEEDS_HOME_LOG}.</div>}
      </div>

      {type === "QURAN" && (
        <div className={styles.field}>
          <div className={hl.formGrid}>
            <div className={hl.field}>
              <label htmlFor="as-surah">السورة</label>
              <select id="as-surah" className={hl.select} value={surah} onChange={(e) => changeSurah(Number(e.target.value))}>
                {SURAHS.map((s) => (
                  <option key={s.number} value={s.number}>
                    {s.number}. {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={hl.field}>
              <label htmlFor="as-from">من الآية</label>
              <select
                id="as-from"
                className={hl.select}
                value={from}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFrom(v);
                  if (to < v) setTo(v);
                  if (to - v + 1 > HOME_LIMITS.maxAyat) setTo(v + HOME_LIMITS.maxAyat - 1);
                }}
              >
                {range(1, count).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className={hl.field}>
              <label htmlFor="as-to">إلى الآية</label>
              <select id="as-to" className={hl.select} value={to} onChange={(e) => setTo(Number(e.target.value))}>
                {range(from, Math.min(count, from + HOME_LIMITS.maxAyat - 1)).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.hint}>
            {p(
              "يُضاف لدى كل طالب في «حفظي في البيت» مقطعٌ بأهدافه المعتادة، مع علامة «واجب».",
              "يُضاف لدى كل طالبة في «حفظي في البيت» مقطعٌ بأهدافها المعتادة، مع علامة «واجب».",
            )}{" "}
            ولا يغيّر ذلك الموقع الرسمي في الخطة.
          </div>
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor="as-desc">الوصف (اختياري)</label>
        <textarea
          id="as-desc"
          className={styles.input}
          value={description}
          maxLength={ASSIGNMENT_LIMITS.descriptionMax}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="as-due">موعد التسليم (اختياري)</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input id="as-due" type="date" className={styles.input} style={{ maxWidth: 220 }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          {dueDate && (
            <button type="button" className={hl.linkBtn} onClick={() => setDueDate("")}>
              بلا موعد
            </button>
          )}
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>لمن الواجب؟</span>
        <div className={styles.pills} role="group" aria-label="لمن الواجب">
          <button type="button" className={`${styles.pill} ${targetKind === "GROUP" ? styles.sel : ""}`} onClick={() => setTargetKind("GROUP")}>
            مجموعة كاملة
          </button>
          <button
            type="button"
            className={`${styles.pill} ${targetKind === "STUDENTS" ? styles.sel : ""}`}
            onClick={() => setTargetKind("STUDENTS")}
          >
            {p("طلاب محدّدون", "طالبات محدّدات")}
          </button>
        </div>
      </div>

      {targetKind === "GROUP" ? (
        <div className={styles.field}>
          <select className={hl.select} value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="المجموعة">
            {groups.map((gr) => (
              <option key={gr.id} value={gr.id}>
                {gr.name}
              </option>
            ))}
          </select>
          <div className={styles.hint}>
            {p("يشمل من يُضاف إلى المجموعة لاحقًا، ولا يشمل المؤرشَفين.", "يشمل من تُضاف إلى المجموعة لاحقًا، ولا يشمل المؤرشَفات.")}
          </div>
        </div>
      ) : (
        <div className={styles.field}>
          <input
            className={styles.input}
            style={{ marginBottom: 6 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم"
            aria-label="بحث بالاسم"
          />
          <div className={styles.picker}>
            {filtered.map((gr) => (
              <div key={gr.id}>
                <div className={styles.pickerGroup}>{gr.name}</div>
                {gr.students.map((s) => (
                  <label key={s.id} className={styles.pickRow}>
                    <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
            ))}
            {filtered.length === 0 && <div className={hl.empty}>لا توجد أسماء مطابقة</div>}
          </div>
          <div className={styles.hint}>المختار: {picked.size}</div>
        </div>
      )}

      {error && <div className={hl.err}>{error}</div>}
      <div className={hl.actionsRow}>
        <button type="submit" className={hl.primaryBtn} disabled={pending}>
          {pending ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        <button type="button" className={hl.ghostBtn} onClick={onCancel} disabled={pending}>
          إلغاء
        </button>
      </div>
    </form>
  );
}
