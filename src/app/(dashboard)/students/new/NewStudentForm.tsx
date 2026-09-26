"use client";

import { useMemo, useState, useTransition } from "react";
import styles from "./new-student.module.css";
import { createStudentAction } from "./actions";
import { AYAH_COUNT, SURAHS, SURAH_BY_NUMBER, MUSHAF_ORDER, MUSHAF_REVERSE_ORDER, JUZ_AMMA_REVERSE_ORDER } from "@/lib/quran-data";
import { calculatePageRange } from "@/lib/recitation/logic";
import { planRange } from "@/lib/students/new-student";
import {
  studentNounDef,
  pickByGroup,
  imperative,
  type GroupGender,
  type PersonGender,
} from "@/lib/text/gender";

type TemplateKey = "mushafrev" | "mushaf" | "juzamma" | "custom";

export function NewStudentForm({
  groups,
  viewerGender,
}: {
  groups: { id: string; name: string; gender: GroupGender }[];
  viewerGender: PersonGender;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [grade, setGrade] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const selectedGender: GroupGender = groups.find((g) => g.id === groupId)?.gender ?? "MIXED";
  const [template, setTemplate] = useState<TemplateKey>("mushafrev");
  const [plan, setPlan] = useState<number[]>(MUSHAF_REVERSE_ORDER);
  const [addSurahNum, setAddSurahNum] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [hasPrior, setHasPrior] = useState(false);
  const [completedSurahs, setCompletedSurahs] = useState<number[]>([]);
  const [rangeFrom, setRangeFrom] = useState<number | null>(null);
  const [rangeTo, setRangeTo] = useState<number | null>(null);
  const [partialSurah, setPartialSurah] = useState<number | null>(null);
  const [partialFrom, setPartialFrom] = useState(1);
  const [partialTo, setPartialTo] = useState(1);

  function applyTemplate(key: TemplateKey) {
    setTemplate(key);
    if (key === "mushafrev") setPlan(MUSHAF_REVERSE_ORDER);
    else if (key === "mushaf") setPlan(MUSHAF_ORDER);
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

  // ---------- prior memorization (before joining) ----------
  const planSurahs = useMemo(() => plan.map((n) => SURAH_BY_NUMBER[n]), [plan]);

  function addRange() {
    if (rangeFrom == null || rangeTo == null) return;
    const rangeSurahs = planRange(plan, rangeFrom, rangeTo);
    if (!rangeSurahs) return;
    setCompletedSurahs((prev) => [...new Set([...prev, ...rangeSurahs])]);
    if (partialSurah != null && rangeSurahs.includes(partialSurah)) setPartialSurah(null);
  }

  function toggleCompleted(surahNumber: number) {
    setCompletedSurahs((prev) =>
      prev.includes(surahNumber) ? prev.filter((n) => n !== surahNumber) : [...prev, surahNumber],
    );
    if (partialSurah === surahNumber) setPartialSurah(null);
  }

  function removeCompleted(surahNumber: number) {
    setCompletedSurahs((prev) => prev.filter((n) => n !== surahNumber));
  }

  function selectPartialSurah(value: string) {
    if (!value) {
      setPartialSurah(null);
      return;
    }
    const n = Number(value);
    setPartialSurah(n);
    setPartialFrom(1);
    setPartialTo(Math.min(15, AYAH_COUNT[n]));
  }

  const partialSurahOptions = planSurahs.filter((s) => !completedSurahs.includes(s.number));
  const partialPreview =
    partialSurah != null ? calculatePageRange(partialSurah, partialFrom, partialTo) : null;
  const completedSurahsInPlanOrder = useMemo(
    () => plan.filter((n) => completedSurahs.includes(n)),
    [plan, completedSurahs],
  );

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
    formData.set("grade", grade);
    formData.set("groupId", groupId);
    formData.set("template", template);
    formData.set("plan", JSON.stringify(plan));
    formData.set("priorCompletedSurahs", hasPrior ? JSON.stringify(completedSurahs) : "[]");
    formData.set(
      "priorPartial",
      hasPrior && partialSurah != null
        ? JSON.stringify({ surahNumber: partialSurah, fromAyah: partialFrom, toAyah: partialTo })
        : "",
    );
    startTransition(async () => {
      const result = await createStudentAction(null, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <div className={styles.secTitle}>
        <span className={styles.dot} /> بيانات {studentNounDef(selectedGender)}
      </div>
      <div className={styles.card}>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="girlName">اسم {studentNounDef(selectedGender)}</label>
            <input id="girlName" type="text" placeholder="مثال: سارة خالد" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="girlAge">العمر</label>
            <input id="girlAge" type="number" placeholder="مثال: 10" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="girlGrade">الصف (اختياري)</label>
            <input id="girlGrade" type="text" placeholder="مثال: الخامس" value={grade} onChange={(e) => setGrade(e.target.value)} />
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
          <div className={`${styles.templateCard} ${template === "mushafrev" ? styles.sel : ""}`} onClick={() => applyTemplate("mushafrev")}>
            <div className={styles.tIcon}>🔁</div>
            <div className={styles.tName}>ترتيب المصحف بالعكس</div>
            <div className={styles.tDesc}>من سورة الناس إلى سورة الفاتحة، عكس ترتيب المصحف.</div>
            <div className={styles.tCount}>114 سورة</div>
          </div>
          <div className={`${styles.templateCard} ${template === "mushaf" ? styles.sel : ""}`} onClick={() => applyTemplate("mushaf")}>
            <div className={styles.tIcon}>📖</div>
            <div className={styles.tName}>ترتيب المصحف</div>
            <div className={styles.tDesc}>من سورة الفاتحة إلى سورة الناس، بالترتيب المعتاد في المصحف.</div>
            <div className={styles.tCount}>114 سورة</div>
          </div>
          <div className={`${styles.templateCard} ${template === "juzamma" ? styles.sel : ""}`} onClick={() => applyTemplate("juzamma")}>
            <div className={styles.tIcon}>🌙</div>
            <div className={styles.tName}>جزء عمّ بالعكس</div>
            <div className={styles.tDesc}>
              من سورة الناس إلى سورة النبأ — {pickByGroup(selectedGender, { m: "يبدأ", f: "تبدأ" })}{" "}
              {studentNounDef(selectedGender)} بأقصر السور.
            </div>
            <div className={styles.tCount}>37 سورة</div>
          </div>
          <div className={`${styles.templateCard} ${template === "custom" ? styles.sel : ""}`} onClick={() => applyTemplate("custom")}>
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
            <div className={`${styles.planRow} ${styles.emptyPlan}`}>
              الخطة فارغة حاليًا — {imperative(viewerGender, { m: "أضف", f: "أضيفي" })} سورة من الأسفل
            </div>
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

      <div className={styles.secTitle}>
        <span className={styles.dot} /> الحفظ السابق (قبل الانضمام)
      </div>
      <div className={styles.card}>
        <div className={styles.groupPills}>
          <div className={`${styles.groupPill} ${!hasPrior ? styles.sel : ""}`} onClick={() => setHasPrior(false)}>
            لا يوجد حفظ سابق
          </div>
          <div className={`${styles.groupPill} ${hasPrior ? styles.sel : ""}`} onClick={() => setHasPrior(true)}>
            نعم، حفظت أجزاءً قبل الانضمام
          </div>
        </div>

        {hasPrior && (
          <div style={{ marginTop: 16 }}>
            <div className={styles.subCard}>
              <div className={styles.subTitle}>تحديد نطاق من الخطة كمحفوظ بالكامل</div>
              <div className={styles.rangeRow}>
                <select value={rangeFrom ?? ""} onChange={(e) => setRangeFrom(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">من سورة...</option>
                  {planSurahs.map((s) => (
                    <option key={s.number} value={s.number}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select value={rangeTo ?? ""} onChange={(e) => setRangeTo(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">إلى سورة...</option>
                  {planSurahs.map((s) => (
                    <option key={s.number} value={s.number}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={addRange} disabled={rangeFrom == null || rangeTo == null}>
                  تحديد كمحفوظ بالكامل
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 8 }}>
                النطاق محسوب حسب ترتيب السور في خطة {studentNounDef(selectedGender)}، وليس ترتيب المصحف
              </div>
            </div>

            <div className={styles.subCard}>
              <div className={styles.subTitle}>
                أو {imperative(viewerGender, { m: "اختر", f: "اختاري" })} سورًا منفردة كمحفوظة بالكامل
              </div>
              <div className={styles.checkList}>
                {planSurahs.map((s) => (
                  <label className={styles.checkRow} key={s.number}>
                    <input
                      type="checkbox"
                      checked={completedSurahs.includes(s.number)}
                      onChange={() => toggleCompleted(s.number)}
                    />
                    {s.name} <span style={{ color: "var(--ink-soft)" }}>({s.ayahs} آية)</span>
                  </label>
                ))}
              </div>
            </div>

            {completedSurahsInPlanOrder.length > 0 ? (
              <div className={styles.chipList}>
                {completedSurahsInPlanOrder.map((n) => (
                  <span className={styles.chip} key={n}>
                    {SURAH_BY_NUMBER[n].name}
                    <button type="button" onClick={() => removeCompleted(n)} title="إزالة">×</button>
                  </span>
                ))}
              </div>
            ) : (
              <div className={styles.emptyChips}>لم تُحدَّد أي سورة كمحفوظة بالكامل بعد</div>
            )}

            <div className={styles.subCard} style={{ marginTop: 16 }}>
              <div className={styles.subTitle}>
                سورة {pickByGroup(selectedGender, { m: "يحفظ", f: "تحفظ" })} منها {studentNounDef(selectedGender)}{" "}
                جزءًا حاليًا (اختياري، سورة واحدة فقط)
              </div>
              <div className={styles.fieldRow} style={{ marginBottom: 0 }}>
                <div className={styles.field}>
                  <select value={partialSurah ?? ""} onChange={(e) => selectPartialSurah(e.target.value)}>
                    <option value="">لا يوجد</option>
                    {partialSurahOptions.map((s) => (
                      <option key={s.number} value={s.number}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                {partialSurah != null && (
                  <>
                    <div className={styles.field}>
                      <label>من آية</label>
                      <input
                        type="number"
                        min={1}
                        value={partialFrom}
                        onChange={(e) => setPartialFrom(parseInt(e.target.value, 10) || 1)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label>إلى آية</label>
                      <input
                        type="number"
                        min={1}
                        value={partialTo}
                        onChange={(e) => setPartialTo(parseInt(e.target.value, 10) || 1)}
                      />
                    </div>
                  </>
                )}
              </div>
              {partialSurah != null && (
                <div style={{ marginTop: 10, fontSize: 12.5 }}>
                  {partialPreview && "error" in partialPreview ? (
                    <span style={{ color: "var(--rose-deep)" }}>{partialPreview.error}</span>
                  ) : (
                    partialPreview && (
                      <span style={{ color: "var(--sage-deep)", fontWeight: 700 }}>
                        {partialPreview.totalPages} صفحة (صفحة {partialPreview.minPage}
                        {partialPreview.maxPage > partialPreview.minPage ? ` إلى ${partialPreview.maxPage}` : ""})
                      </span>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <div className={styles.err}>{error}</div>}
      <button className={styles.saveBtn} onClick={submit} disabled={pending} type="button">
        {pending ? "جارٍ الحفظ..." : `حفظ ${studentNounDef(selectedGender)} والخطة`}
      </button>
      <div className={styles.note}>يمكن اختيار قالب جاهز كبداية، ثم إعادة ترتيب السور أو حذف/إضافة أي سورة يدويًا قبل الحفظ</div>
    </div>
  );
}
