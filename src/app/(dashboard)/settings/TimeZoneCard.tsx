"use client";

import { useState, useTransition } from "react";
import styles from "./settings.module.css";
import { setCourseLocationAction, setTimeZoneAction } from "./actions";
import { CityPicker } from "@/components/prayer/CityPicker";
import type { PrayerLocation } from "@/lib/prayer/times";
import { COMMON_ZONES, allZoneIds, zoneName } from "@/lib/time/zones";
import { zoneOffsetLabel } from "@/lib/time/zone";

const MAX_RESULTS = 20;

// the zones as a wrapping row of pills (optionPills is a column elsewhere)
const pillsRow: React.CSSProperties = { flexDirection: "row", flexWrap: "wrap", minWidth: 0 };

const noteStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "var(--cream)",
  fontSize: 12.5,
  lineHeight: 1.8,
  color: "var(--ink)",
};

/**
 * «التوقيت»: the time zone the course's days are counted in (lib/time/zone.ts). Supervisor only.
 * offsets: the common zones' current offsets as the server computes them —
 * the server decides the course's days, and a browser's own zone tables can
 * differ (and would break hydration). Search results use the browser's.
 */
export function TimeZoneCard({
  timeZone,
  currentLabel,
  offsets,
  place,
}: {
  timeZone: string;
  currentLabel: string;
  offsets: Record<string, string>;
  // the course's place for prayer times (null: none)
  place: PrayerLocation | null;
}) {
  const [current, setCurrent] = useState(timeZone);
  const [label, setLabel] = useState(currentLabel);
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const offsetOf = (id: string) => offsets[id] ?? zoneOffsetLabel(id);
  const labelOf = (id: string) => `${zoneName(id)} (⁦${offsetOf(id)}⁩)`;
  const q = query.trim().toLowerCase();
  const results = q
    ? allZoneIds()
        .filter((id) => id.toLowerCase().replace(/_/g, " ").includes(q.replace(/_/g, " ")) || zoneName(id).includes(query.trim()))
        .slice(0, MAX_RESULTS)
    : [];

  function pick(id: string) {
    if (pending) return;
    setError(null);
    setSaved(false);
    setPicked(id === current ? null : id);
  }

  function save() {
    if (!picked) return;
    const next = picked;
    setError(null);
    startTransition(async () => {
      const result = await setTimeZoneAction(next);
      if (result.error) {
        setError(result.error);
        return;
      }
      setCurrent(next);
      setLabel(labelOf(next));
      setPicked(null);
      setQuery("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  const pill = (id: string, text: string) => (
    <div
      key={id}
      className={`${styles.optionPill} ${(picked ?? current) === id ? styles.sel : ""}`}
      onClick={() => pick(id)}
      title={id}
    >
      {text} <span dir="ltr" style={{ opacity: 0.7 }}>{offsetOf(id)}</span>
    </div>
  );

  return (
    <div className={styles.settingRow} style={{ borderBottom: "none", display: "block" }}>
      <div className={styles.settingText}>
        <div className={styles.settingTitle}>توقيت الدورة</div>
        <div className={styles.settingDesc}>
          تُحسب أيام الدورة بهذا التوقيت: «اليوم» في الحضور والنقاط وتاريخ التسميع، وبداية الأسبوع في الأسابيع المتتالية،
          وتذكير المراجعة، وهدف الحفظ وموعده، والتقارير، و«التسميع بدون إنترنت»، والواجبات وجدول المتابعة، والتقويم
          الهجري.
        </div>
        <div style={{ marginTop: 10, fontSize: 13.5 }}>
          التوقيت الحالي: <b>{label}</b>
          {saved && <span style={{ color: "var(--green-deep, var(--ink))", marginInlineStart: 8 }}>تم الحفظ ✓</span>}
        </div>
      </div>

      <div className={styles.optionPills} style={{ ...pillsRow, marginTop: 12 }}>
        {COMMON_ZONES.map((z) => pill(z.id, z.city))}
      </div>

      <div style={{ marginTop: 12 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث في كل المناطق الزمنية (مثل London أو Jakarta)"
          aria-label="بحث في المناطق الزمنية"
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--cream)",
            fontSize: 14,
            color: "var(--ink)",
          }}
        />
        {q && (
          <div className={styles.optionPills} style={{ ...pillsRow, marginTop: 8 }}>
            {results.length === 0 ? (
              <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>لا توجد نتائج</span>
            ) : (
              results.map((id) => pill(id, `${id.replace(/_/g, " ")} — ${zoneName(id)}`))
            )}
          </div>
        )}
      </div>

      {picked && (
        <div style={noteStyle} role="alert">
          <b>قبل الحفظ:</b> سيصبح توقيت الدورة <b>{labelOf(picked)}</b>، وتتغيّر بداية اليوم في الدورة من الآن.
          <ul style={{ margin: "6px 0 0", paddingInlineStart: 18 }}>
            <li>لا يتغيّر شيء مما حُفظ بتاريخه: الحضور والنقاط وعلامات جدول المتابعة والمواعيد تبقى في أيامها.</li>
            <li>ما سُجّل من تسميع قرب منتصف الليل قد يظهر في اليوم المجاور، في السجل والأسابيع المتتالية والتقارير.</li>
            <li>قد يصبح «اليوم» الآن يومًا آخر، فيظهر حضور سُجّل قبل قليل في يوم مختلف عن «اليوم» الجديد.</li>
          </ul>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" className={styles.copyBtn} style={{ marginTop: 0 }} disabled={pending} onClick={save}>
              {pending ? "جارٍ الحفظ…" : "حفظ التوقيت"}
            </button>
            <button type="button" className={styles.copyBtn} style={{ marginTop: 0, background: "transparent", color: "var(--ink)" }} disabled={pending} onClick={() => setPicked(null)}>
              إلغاء
            </button>
          </div>
        </div>
      )}
      {error && <div style={{ color: "var(--rose-deep)", fontSize: 12.5, marginTop: 8 }}>{error}</div>}

      <div className={styles.settingTitle} style={{ marginTop: 22 }}>
        مدينة الدورة (لمواقيت الصلاة)
      </div>
      <CityPicker
        initial={place}
        previewZone={current}
        intro="تحديد مدينة الدورة يتيح في الجدول اليومي أوقاتًا بالنسبة إلى الصلاة (مثل «بعد الفجر» أو «قبل المغرب بـ 15 دقيقة») تتغيّر مع المواسم، وتظهر مواقيت اليوم على جدول اليوم. اختيار مدينة يقترح منطقتها الزمنية أعلاه (ويمكن تغييرها). من غير مدينة تعمل الأوقات المحدّدة كما هي."
        onSave={setCourseLocationAction}
        onCity={(c) => c.tz !== current && pick(c.tz)}
      />
    </div>
  );
}
