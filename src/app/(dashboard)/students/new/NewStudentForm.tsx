"use client";

import { useMemo, useState, useTransition } from "react";
import styles from "./new-student.module.css";
import { createStudentAction } from "./actions";
import { SURAHS, SURAH_BY_NUMBER, MUSHAF_ORDER, JUZ_AMMA_REVERSE_ORDER } from "@/lib/quran-data";

type TemplateKey = "mushaf" | "juzamma" | "custom";

export function NewStudentForm({ groups }: { groups: { id: string; name: string }[] }) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [template, setTemplate] = useState<TemplateKey>("mushaf");
  const [plan, setPlan] = useState<number[]>(MUSHAF_ORDER);
  const [addSurahNum, setAddSurahNum] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function applyTemplate(key: TemplateKey) {
    setTemplate(key);
    if (key === "mushaf") setPlan(MUSHAF_ORDER);
    else if (key === "juzamma") setPlan(JUZ_AMMA_REVERSE_ORDER);
    else setPlan([]);
  }

  function moveUp(i: number) {
    if (i === 0) return;
    setPlan((p) => {
      const next = [...p];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  }
  function moveDown(i: number) {
    setPlan((p) => {
      if (i === p.length - 1) return p;
      const next = [...p];
      [next[i + 1], next[i]] = [next[i], next[i + 1]];
      return next;
    });
  }
  function removeSurah(i: number) {
    setPlan((p) => p.filter((_, idx) => idx !== i));
  }
  function addSurah() {
    setPlan((p) => (p.includes(addSurahNum) ? p : [...p, addSurahNum]));
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

  function submit() {
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("age", age);
    formData.set("groupId", groupId);
    formData.set("template", template);
    formData.set("plan", JSON.stringify(plan));
    startTransition(async () => {
      const result = await createStudentAction(null, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <div className={styles.secTitle}>
        <span className={styles.dot} /> بيانات الطالبة
      </div>
      <div className={styles.card}>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="girlName">اسم الطالبة</label>
            <input id="girlName" type="text" placeholder="مثال: سارة خالد" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="girlAge">العمر</label>
            <input id="girlAge" type="number" placeholder="مثال: 10" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
        </div>
        <div className={styles.field}>
          <label>المجموعة</label>
          <div className={styles.groupPills}>
            {groups.map((g) => (
              <div
                key={g.id}
                className={`${styles.groupPill} ${groupId === g.id ? styles.sel : ""}`}
                onClick={() => setGroupId(g.id)}
              >
                {g.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.secTitle}>
        <span className={styles.dot} /> اختيار قالب خطة الحفظ
      </div>
      <div className={styles.card}>
        <div className={styles.templateGrid}>
          <div className={`${styles.templateCard} ${template === "mushaf" ? styles.sel : ""}`} onClick={() => applyTemplate("mushaf")}>
            <div className={styles.tIcon}>📖</div>
            <div className={styles.tName}>ترتيب المصحف</div>
            <div className={styles.tDesc}>من سورة الفاتحة إلى سورة الناس، بالترتيب المعتاد في المصحف.</div>
            <div className={styles.tCount}>114 سورة</div>
          </div>
          <div className={`${styles.templateCard} ${template === "juzamma" ? styles.sel : ""}`} onClick={() => applyTemplate("juzamma")}>
            <div className={styles.tIcon}>🌙</div>
            <div className={styles.tName}>جزء عمّ بالعكس</div>
            <div className={styles.tDesc}>من سورة الناس إلى سورة النبأ — تبدأ الطالبة بأقصر السور.</div>
            <div className={styles.tCount}>37 سورة</div>
          </div>
          <div className={`${styles.templateCard} ${template === "custom" ? styles.sel : ""}`} onClick={() => applyTemplate("custom")}>
            <div className={styles.tIcon}>✏️</div>
            <div className={styles.tName}>خطة مخصّصة</div>
            <div className={styles.tDesc}>تبدأ الخطة فارغة، وتختار المعلمة السور وترتيبها يدويًا بالكامل.</div>
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
            <div className={`${styles.planRow} ${styles.emptyPlan}`}>الخطة فارغة حاليًا — أضيفي سورة من الأسفل</div>
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

      {error && <div className={styles.err}>{error}</div>}
      <button className={styles.saveBtn} onClick={submit} disabled={pending} type="button">
        {pending ? "جارٍ الحفظ..." : "حفظ الطالبة والخطة"}
      </button>
      <div className={styles.note}>يمكن اختيار قالب جاهز كبداية، ثم إعادة ترتيب السور أو حذف/إضافة أي سورة يدويًا قبل الحفظ</div>
    </div>
  );
}
