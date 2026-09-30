"use client";

import { useState, useTransition } from "react";
import styles from "./calendar.module.css";
import {
  fromHijri,
  gregorianLabelWithWeekday,
  hijriLabel,
  hijriMonthLength,
  HIJRI_MONTHS,
  isValidIso,
  toHijri,
} from "@/lib/calendar/hijri";

export type EventInput = { title: string; date: string; description: string };

type Mode = "GREGORIAN" | "HIJRI";

// Gregorian date input with a live Hijri preview, or (toggle) Hijri
// day/month/year with a live Gregorian preview. Either way the value sent to
// the server is the Gregorian "YYYY-MM-DD".
export function EventForm({
  heading,
  initial,
  onSubmit,
  onCancel,
}: {
  heading: string;
  initial: EventInput;
  onSubmit: (input: EventInput) => Promise<{ error?: string }>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [mode, setMode] = useState<Mode>("GREGORIAN");
  const [gregorian, setGregorian] = useState(initial.date);
  const start = toHijri(initial.date);
  const [hDay, setHDay] = useState(start.day);
  const [hMonth, setHMonth] = useState(start.month);
  const [hYear, setHYear] = useState(String(start.year));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hYearNumber = Number(hYear);
  const hYearValid = Number.isInteger(hYearNumber) && hYearNumber >= 1320 && hYearNumber <= 1580;
  const hijriIso = hYearValid ? fromHijri(hYearNumber, hMonth, hDay) : null;
  const date = mode === "GREGORIAN" ? (isValidIso(gregorian) ? gregorian : null) : hijriIso;

  let preview: string | null = null;
  let dateError: string | null = null;
  if (mode === "GREGORIAN") {
    if (date) preview = `يوافق ${hijriLabel(toHijri(date))}`;
  } else if (!hYearValid) {
    dateError = "يُرجى إدخال سنة هجرية صحيحة";
  } else if (!hijriIso) {
    dateError = `لا يوجد يوم ${hDay} في شهر ${HIJRI_MONTHS[hMonth - 1]} ${hYearNumber} هـ؛ عدد أيامه ${hijriMonthLength(hYearNumber, hMonth)}`;
  } else {
    preview = `يوافق ${gregorianLabelWithWeekday(hijriIso)}`;
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    // carry the chosen day across, so switching never loses it
    if (next === "HIJRI" && date) {
      const h = toHijri(date);
      setHDay(h.day);
      setHMonth(h.month);
      setHYear(String(h.year));
    } else if (next === "GREGORIAN" && date) {
      setGregorian(date);
    }
    setMode(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("يُرجى إدخال عنوان الفعالية");
    if (!date) return setError(dateError ?? "يُرجى اختيار تاريخ صحيح");
    startTransition(async () => {
      const result = await onSubmit({ title, date, description });
      if (result.error) setError(result.error);
    });
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
        <span>
          <span className={styles.dot} />
          {heading}
        </span>
      </div>

      <div className={styles.field}>
        <label htmlFor="event-title">العنوان</label>
        <input
          id="event-title"
          className={styles.input}
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثال: حفل ختم القرآن"
          autoFocus
        />
      </div>

      <div className={styles.field}>
        <label>التاريخ</label>
        <div className={styles.modePills} role="group" aria-label="نوع التقويم">
          <button
            type="button"
            className={`${styles.modePill} ${mode === "GREGORIAN" ? styles.sel : ""}`}
            onClick={() => switchMode("GREGORIAN")}
          >
            ميلادي
          </button>
          <button
            type="button"
            className={`${styles.modePill} ${mode === "HIJRI" ? styles.sel : ""}`}
            onClick={() => switchMode("HIJRI")}
          >
            هجري
          </button>
        </div>
        {mode === "GREGORIAN" ? (
          <input
            type="date"
            className={styles.input}
            value={gregorian}
            onChange={(e) => setGregorian(e.target.value)}
            aria-label="التاريخ الميلادي"
          />
        ) : (
          <div className={styles.hijriInputs}>
            <select value={hDay} onChange={(e) => setHDay(Number(e.target.value))} aria-label="اليوم">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select value={hMonth} onChange={(e) => setHMonth(Number(e.target.value))} aria-label="الشهر">
              {HIJRI_MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="numeric"
              value={hYear}
              onChange={(e) => setHYear(e.target.value)}
              aria-label="السنة الهجرية"
            />
          </div>
        )}
        {preview && <div className={styles.preview}>{preview}</div>}
        {dateError && <div className={styles.err}>{dateError}</div>}
      </div>

      <div className={styles.field}>
        <label htmlFor="event-desc">الوصف (اختياري)</label>
        <textarea
          id="event-desc"
          className={styles.input}
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {error && <div className={styles.err}>{error}</div>}
      <div className={styles.formActions}>
        <button type="submit" className={styles.addBtn} disabled={pending}>
          {pending ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        <button type="button" className={styles.ghostBtn} onClick={onCancel} disabled={pending}>
          إلغاء
        </button>
      </div>
    </form>
  );
}
