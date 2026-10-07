"use client";

import { useMemo, useState } from "react";
import styles from "./plan.module.css";
import { SURAHS, SURAH_BY_NUMBER, MUSHAF_ORDER, MUSHAF_REVERSE_ORDER, JUZ_AMMA_REVERSE_ORDER } from "@/lib/quran-data";

// Choosing a memorization plan: the four templates, then the plan itself as
// an editable list (reorder, remove, add a surah) with a short summary.
// Shared by the staff «add student» form and «رفيق الحفظ».

export type TemplateKey = "mushafrev" | "mushaf" | "juzamma" | "custom";

export const TEMPLATE_KEY_PLAN = {
  mushafrev: "MUSHAF_REVERSE",
  mushaf: "MUSHAF_ORDER",
  juzamma: "JUZ_AMMA_REVERSE",
  custom: "CUSTOM",
} as const;

/** The sequence a template starts from (custom starts empty). */
export function templateSurahs(key: TemplateKey): number[] {
  if (key === "mushafrev") return MUSHAF_REVERSE_ORDER;
  if (key === "mushaf") return MUSHAF_ORDER;
  if (key === "juzamma") return JUZ_AMMA_REVERSE_ORDER;
  return [];
}

export type PlanEditorWords = {
  // «تبدأ الطالبة» / «تبدئين» — who starts with the shortest surahs
  juzAmmaStarts: string;
  // «أضيفي» / «أضف» — addressed to whoever is editing
  add: string;
};

export function PlanEditor({
  template,
  plan,
  onTemplate,
  onPlanChange,
  words,
}: {
  template: TemplateKey;
  plan: number[];
  onTemplate: (key: TemplateKey) => void;
  onPlanChange: (update: (plan: number[]) => number[]) => void;
  words: PlanEditorWords;
}) {
  const [addSurahNum, setAddSurahNum] = useState<number>(1);

  function moveUp(i: number) {
    if (i === 0) return;
    onPlanChange((p) => {
      const next = [...p];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  }
  function moveDown(i: number) {
    onPlanChange((p) => {
      if (i === p.length - 1) return p;
      const next = [...p];
      [next[i + 1], next[i]] = [next[i], next[i + 1]];
      return next;
    });
  }
  function removeSurah(i: number) {
    onPlanChange((p) => p.filter((_, idx) => idx !== i));
  }
  function addSurah() {
    onPlanChange((p) => (p.includes(addSurahNum) ? p : [...p, addSurahNum]));
  }

  const stats = useMemo(
    () => ({
      count: plan.length,
      ayahs: plan.reduce((sum, n) => sum + SURAH_BY_NUMBER[n].ayahs, 0),
      first: plan.length ? SURAH_BY_NUMBER[plan[0]].name : "—",
      last: plan.length ? SURAH_BY_NUMBER[plan[plan.length - 1]].name : "—",
    }),
    [plan],
  );

  return (
    <>
      <div className={styles.secTitle}>
        <span className={styles.dot} /> اختيار قالب خطة الحفظ
      </div>
      <div className={styles.card}>
        <div className={styles.templateGrid}>
          <div className={`${styles.templateCard} ${template === "mushafrev" ? styles.sel : ""}`} onClick={() => onTemplate("mushafrev")}>
            <div className={styles.tIcon}>🔁</div>
            <div className={styles.tName}>ترتيب المصحف بالعكس</div>
            <div className={styles.tDesc}>من سورة الناس إلى سورة الفاتحة، عكس ترتيب المصحف.</div>
            <div className={styles.tCount}>114 سورة</div>
          </div>
          <div className={`${styles.templateCard} ${template === "mushaf" ? styles.sel : ""}`} onClick={() => onTemplate("mushaf")}>
            <div className={styles.tIcon}>📖</div>
            <div className={styles.tName}>ترتيب المصحف</div>
            <div className={styles.tDesc}>من سورة الفاتحة إلى سورة الناس، بالترتيب المعتاد في المصحف.</div>
            <div className={styles.tCount}>114 سورة</div>
          </div>
          <div className={`${styles.templateCard} ${template === "juzamma" ? styles.sel : ""}`} onClick={() => onTemplate("juzamma")}>
            <div className={styles.tIcon}>🌙</div>
            <div className={styles.tName}>جزء عمّ بالعكس</div>
            <div className={styles.tDesc}>من سورة الناس إلى سورة النبأ — {words.juzAmmaStarts} بأقصر السور.</div>
            <div className={styles.tCount}>37 سورة</div>
          </div>
          <div className={`${styles.templateCard} ${template === "custom" ? styles.sel : ""}`} onClick={() => onTemplate("custom")}>
            <div className={styles.tIcon}>✏️</div>
            <div className={styles.tName}>خطة مخصّصة</div>
            <div className={styles.tDesc}>تبدأ الخطة فارغة، وتُختار السور وترتيبها يدويًا بالكامل.</div>
            <div className={styles.tCount}>حسب الاختيار</div>
          </div>
        </div>
      </div>

      <div className={styles.secTitle}>
        <span className={styles.dot} /> ترتيب الخطة (قابل للتعديل)
      </div>
      <div className={styles.card}>
        <div className={styles.planList}>
          {plan.length === 0 ? (
            <div className={`${styles.planRow} ${styles.emptyPlan}`}>الخطة فارغة حاليًا — {words.add} سورة من الأسفل</div>
          ) : (
            plan.map((num, i) => (
              <div className={styles.planRow} key={`${num}-${i}`}>
                <div className={styles.idx}>{i + 1}</div>
                <div className={styles.pName}>{SURAH_BY_NUMBER[num].name}</div>
                <div className={styles.pAyahs}>{SURAH_BY_NUMBER[num].ayahs} آية</div>
                <div className={styles.pActions}>
                  <button type="button" onClick={() => moveUp(i)} disabled={i === 0} title="نقل لأعلى">▲</button>
                  <button type="button" onClick={() => moveDown(i)} disabled={i === plan.length - 1} title="نقل لأسفل">▼</button>
                  <button type="button" onClick={() => removeSurah(i)} title="حذف">×</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.addRow}>
          <select value={addSurahNum} onChange={(e) => setAddSurahNum(Number(e.target.value))}>
            {SURAHS.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={addSurah}>إضافة سورة</button>
        </div>

        <div className={styles.planSummary}>
          <div className={styles.miniStat}>
            <div className={styles.num}>{stats.count}</div>
            <div className={styles.lbl}>عدد السور في الخطة</div>
          </div>
          <div className={styles.miniStat}>
            <div className={styles.num}>{stats.ayahs}</div>
            <div className={styles.lbl}>إجمالي عدد الآيات</div>
          </div>
          <div className={styles.miniStat}>
            <div className={styles.num}>{stats.first}</div>
            <div className={styles.lbl}>أول سورة في الخطة</div>
          </div>
          <div className={styles.miniStat}>
            <div className={styles.num}>{stats.last}</div>
            <div className={styles.lbl}>آخر سورة في الخطة</div>
          </div>
        </div>
      </div>
    </>
  );
}
