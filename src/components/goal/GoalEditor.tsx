"use client";

import { useMemo, useState, useTransition } from "react";
import styles from "./goal.module.css";
import rs from "@/components/recitation/recitation.module.css";
import { AYAH_COUNT, SURAH_NAME } from "@/lib/quran-data";
import { juzOf } from "@/lib/quran-data/juz";
import { targetLabel, type GoalTarget, type GoalTargetKind } from "@/lib/goals/goal";
import type { GoalInput } from "@/lib/goals/input";

// «هدف الحفظ»: setting, changing or removing her goal — in «خطة الحفظ» on
// the staff student page and in «خطتي» («رفيق الحفظ»). The target is chosen
// from her current plan; the server checks everything again.

const KIND_LABEL: Record<GoalTargetKind, string> = { PLAN: "إكمال الخطة", JUZ: "حتى نهاية جزء", POINT: "حتى سورة أو آية" };

export function GoalEditor({
  plan,
  current,
  today,
  hint,
  onSave,
  onRemove,
}: {
  plan: number[];
  // the stored goal, or null
  current: (GoalTarget & { deadline: string }) | null;
  // the earliest deadline («today» as the goal counts it); null until known
  today: string | null;
  // what the daily target means, worded for the page
  hint: string;
  onSave: (goal: GoalInput) => Promise<{ error?: string }>;
  onRemove: () => Promise<{ error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [kind, setKind] = useState<GoalTargetKind>("PLAN");
  const [juz, setJuz] = useState<number | null>(null);
  const [surah, setSurah] = useState<number>(plan[0] ?? 1);
  const [ayah, setAyah] = useState<number>(AYAH_COUNT[plan[0] ?? 1]);
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // the juz her plan reaches, in the order her plan meets them
  const juzOptions = useMemo(() => {
    const seen: number[] = [];
    for (const s of plan) {
      // every juz the surah touches (Al-Baqarah: 1, 2 and 3)
      for (let j = juzOf(s, 1) ?? 0; j > 0 && j <= (juzOf(s, AYAH_COUNT[s]) ?? 0); j++) {
        if (!seen.includes(j)) seen.push(j);
      }
    }
    return seen;
  }, [plan]);

  function open() {
    setError(null);
    setKind(current?.target ?? "PLAN");
    setJuz(current?.juz ?? juzOptions[0] ?? null);
    const s = current?.surah ?? plan[0] ?? 1;
    setSurah(s);
    setAyah(current?.ayah ?? AYAH_COUNT[s]);
    setDeadline(current?.deadline ?? "");
    setEditing(true);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await onSave({ target: kind, juz: kind === "JUZ" ? juz : null, surah: kind === "POINT" ? surah : null, ayah: kind === "POINT" ? ayah : null, deadline });
      if (r.error) return setError(r.error);
      setEditing(false);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const r = await onRemove();
      if (r.error) return setError(r.error);
      setConfirmRemove(false);
    });
  }

  if (plan.length === 0) return null;

  return (
    <div className={styles.box}>
      <div className={styles.head}>🎯 هدف الحفظ</div>
      {!editing ? (
        <>
          {current && (
            <div className={styles.current}>
              <b>{targetLabel(current)}</b> · الموعد {current.deadline}
            </div>
          )}
          <div className={styles.actions}>
            {confirmRemove ? (
              <>
                <span>حذف الهدف؟ لا يتغيّر شيء من الحفظ.</span>
                <button type="button" className={styles.linkDanger} disabled={pending} onClick={remove}>
                  تأكيد الحذف
                </button>
                <button type="button" className={styles.link} onClick={() => setConfirmRemove(false)}>
                  تراجع
                </button>
              </>
            ) : (
              <>
                <button type="button" className={styles.link} onClick={open}>
                  {current ? "تعديل الهدف" : "+ هدف للحفظ"}
                </button>
                {current && (
                  <button type="button" className={styles.linkDanger} onClick={() => setConfirmRemove(true)}>
                    حذف الهدف
                  </button>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <p className={styles.hint}>{hint}</p>
          <div className={styles.pills} role="radiogroup" aria-label="الهدف">
            {(["PLAN", "JUZ", "POINT"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                className={`${styles.pill} ${kind === k ? styles.sel : ""}`}
                onClick={() => setKind(k)}
                disabled={k === "JUZ" && juzOptions.length === 0}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <div className={rs.fieldRow}>
            {kind === "JUZ" && (
              <div className={rs.field}>
                <label htmlFor="goalJuz">الجزء</label>
                <select id="goalJuz" value={juz ?? ""} onChange={(e) => setJuz(Number(e.target.value))}>
                  {juzOptions.map((j) => (
                    <option key={j} value={j}>
                      الجزء {j}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {kind === "POINT" && (
              <>
                <div className={rs.field}>
                  <label htmlFor="goalSurah">حتى سورة</label>
                  <select
                    id="goalSurah"
                    value={surah}
                    onChange={(e) => {
                      const s = Number(e.target.value);
                      setSurah(s);
                      setAyah(AYAH_COUNT[s]);
                    }}
                  >
                    {plan.map((s) => (
                      <option key={s} value={s}>
                        {SURAH_NAME[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={rs.field}>
                  <label htmlFor="goalAyah">الآية</label>
                  <input
                    id="goalAyah"
                    type="number"
                    min={1}
                    max={AYAH_COUNT[surah]}
                    value={ayah}
                    onChange={(e) => setAyah(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              </>
            )}
            <div className={rs.field}>
              <label htmlFor="goalDeadline">الموعد</label>
              <input id="goalDeadline" type="date" min={today ?? undefined} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          {error && <div className={styles.err}>{error}</div>}
          <div className={styles.actions}>
            <button className={rs.saveBtn} onClick={save} disabled={pending || !deadline || !today} type="button">
              {pending ? "جارٍ الحفظ..." : "حفظ الهدف"}
            </button>
            <button className={styles.link} onClick={() => setEditing(false)} disabled={pending} type="button">
              إلغاء
            </button>
          </div>
        </>
      )}
      {!editing && error && <div className={styles.err}>{error}</div>}
    </div>
  );
}
