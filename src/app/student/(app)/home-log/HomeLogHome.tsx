"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "@/components/home-log/home-log.module.css";
import { TargetProgress, segmentTitle } from "@/components/home-log/TargetProgress";
import { useSurahText } from "@/components/home-log/useSurahText";
import { quranFont } from "@/components/mistakes/quran-font";
import { AYAH_COUNT, SURAHS } from "@/lib/quran-data";
import { HOME_LIMITS } from "@/lib/home-log/rules";
import type { HomeLogView, HomeSegmentView } from "@/lib/home-log/data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { createSegmentAction } from "./actions";

export function HomeLogHome({
  log,
  groupGender: g,
  plan,
  suggestion,
}: {
  log: HomeLogView;
  groupGender: GroupGender;
  plan: number[];
  suggestion: { surahNumber: number; fromAyah: number; toAyah: number };
}) {
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const [adding, setAdding] = useState(false);
  const full = log.active.length >= HOME_LIMITS.maxActiveSegments;

  return (
    <div>
      <div className={styles.sectionTitle}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>🏠 حفظي في البيت</span>
        {!adding && (
          <button type="button" className={styles.primaryBtn} onClick={() => setAdding(true)} disabled={full}>
            + مقطع جديد
          </button>
        )}
      </div>
      <p className={styles.muted} style={{ margin: "0 4px 12px" }}>
        {p("سجّل", "سجّلي")} هنا ما {p("تحفظه", "تحفظينه")} في البيت، {p("واضغط", "واضغطي")} «+» كلما{" "}
        {p("استمعتَ أو كرّرتَ أو سمّعتَ", "استمعتِ أو كرّرتِ أو سمّعتِ")} لأحد. هذا سجلّ للتدريب فقط، ولا يتقدّم موقعك في
        الخطة إلا بتسميع للمعلم.
      </p>
      {full && !adding && (
        <p className={styles.err} style={{ margin: "0 4px 12px" }}>
          لديك {HOME_LIMITS.maxActiveSegments} مقاطع قيد الحفظ — {p("أتمّ", "أتمّي")} أحدها لإضافة مقطع جديد.
        </p>
      )}

      {adding && <NewSegment g={g} plan={plan} suggestion={suggestion} onCancel={() => setAdding(false)} />}

      <div className={styles.sectionTitle}>قيد الحفظ</div>
      {log.active.length === 0 ? (
        <div className={styles.section}>
          <div className={styles.empty}>لا توجد مقاطع قيد الحفظ — {p("ابدأ", "ابدئي")} بإضافة مقطع جديد.</div>
        </div>
      ) : (
        <div className={styles.cards} style={{ marginBottom: 14 }}>
          {log.active.map((s) => (
            <SegmentCard key={s.id} s={s} g={g} />
          ))}
        </div>
      )}

      {log.past.length > 0 && (
        <>
          <div className={styles.sectionTitle}>مقاطع سابقة</div>
          <div className={styles.cards}>
            {log.past.map((s) => (
              <SegmentCard key={s.id} s={s} g={g} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SegmentCard({ s, g }: { s: HomeSegmentView; g: GroupGender }) {
  const active = s.finishedAt === null;
  const body = (
    <>
      <div className={styles.segTitle}>
        {segmentTitle(s)}
        {s.targetsMet && <span className={styles.badge}>🎉 {pickByGroup(g, { m: "أنجزتَ الأهداف", f: "أنجزتِ الأهداف" })}</span>}
        {s.finishedBy === "TEACHER_RECITED" && <span className={`${styles.badge} ${styles.teacher}`}>سُمِّع للمعلم ✓</span>}
      </div>
      <div className={styles.segMeta}>
        بدأ {s.createdAt}
        {s.finishedAt && ` · انتهى ${s.finishedAt}`}
      </div>
      <TargetProgress counts={s.counts} targets={s.targets} />
    </>
  );
  return active ? (
    <Link href={`/student/home-log/${s.id}`} className={`${styles.segCard} ${s.targetsMet ? styles.done : ""}`}>
      {body}
    </Link>
  ) : (
    <div className={`${styles.segCard} ${styles.done}`}>{body}</div>
  );
}

function NewSegment({
  g,
  plan,
  suggestion,
  onCancel,
}: {
  g: GroupGender;
  plan: number[];
  suggestion: { surahNumber: number; fromAyah: number; toAyah: number };
  onCancel: () => void;
}) {
  const router = useRouter();
  const [surah, setSurah] = useState(suggestion.surahNumber);
  const [from, setFrom] = useState(suggestion.fromAyah);
  const [to, setTo] = useState(suggestion.toAyah);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ayahs = useSurahText(surah);
  const count = AYAH_COUNT[surah] ?? 1;
  const p = (m: string, f: string) => pickByGroup(g, { m, f });

  // her plan's surahs first, then the rest of the Quran
  const planSet = new Set(plan);
  const ordered = [...plan.map((n) => SURAHS.find((s) => s.number === n)!).filter(Boolean), ...SURAHS.filter((s) => !planSet.has(s.number))];

  function changeSurah(n: number) {
    setSurah(n);
    setFrom(1);
    setTo(Math.min(AYAH_COUNT[n] ?? 1, 10));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await createSegmentAction({ surahNumber: surah, fromAyah: from, toAyah: to });
      if (r.error) return setError(r.error);
      router.push(`/student/home-log/${r.id}`);
    });
  }

  const range = (lo: number, hi: number) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle} style={{ margin: "0 0 10px" }}>
        مقطع جديد
      </div>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label htmlFor="seg-surah">السورة</label>
          <select id="seg-surah" className={styles.select} value={surah} onChange={(e) => changeSurah(Number(e.target.value))}>
            {ordered.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.name}
                {planSet.has(s.number) ? " ★" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="seg-from">من الآية</label>
          <select
            id="seg-from"
            className={styles.select}
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
        <div className={styles.field}>
          <label htmlFor="seg-to">إلى الآية</label>
          <select id="seg-to" className={styles.select} value={to} onChange={(e) => setTo(Number(e.target.value))}>
            {range(from, Math.min(count, from + HOME_LIMITS.maxAyat - 1)).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.muted} style={{ marginBottom: 6 }}>
        ★ سور خطتك · المقترح: ما بعد موقعك الرسمي في الخطة، {p("ويمكنك", "ويمكنكِ")} اختيار غيره.
      </div>
      <div className={`${styles.preview} ${quranFont.className}`} lang="ar">
        {ayahs
          ? ayahs.slice(from - 1, to).map((t, i) => (
              <span key={from + i}>
                {t} <span className={styles.ayahNum}>﴿{from + i}﴾</span>{" "}
              </span>
            ))
          : "…"}
      </div>
      {error && <div className={styles.err}>{error}</div>}
      <div className={styles.actionsRow}>
        <button type="button" className={styles.primaryBtn} onClick={save} disabled={pending}>
          {pending ? "جارٍ الحفظ…" : p("ابدأ هذا المقطع", "ابدئي هذا المقطع")}
        </button>
        <button type="button" className={styles.ghostBtn} onClick={onCancel} disabled={pending}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
