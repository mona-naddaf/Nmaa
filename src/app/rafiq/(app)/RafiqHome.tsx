"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "../rafiq.module.css";
import { AYAH_COUNT, SURAH_NAME, TOTAL_PAGES } from "@/lib/quran-data";
import type { RecitationSubject } from "@/lib/recitation/logic";
import type { MemorizationView } from "@/lib/rafiq/memorization";
import type { CommitmentData } from "@/lib/rafiq/commitment";
import { computeStreak, streakDaysText, weekView } from "@/lib/rafiq/streak";
import { WEEKDAY_SHORT, weekdayOf } from "@/lib/tracker/rules";
import Link from "next/link";
import { loggableDays } from "@/lib/rafiq/days";
import { useToday } from "@/lib/calendar/useToday";
import { pickByPerson, type PersonGender } from "@/lib/text/gender";
import { DAYS_AFTER_PREP, SESSIONS, SURAHS_COUNT, WORDS, countLabel } from "@/lib/text/count";
import { Collapsible } from "@/components/collapsible/Collapsible";
import { MistakesList } from "@/components/mistakes/MistakesList";
import { WordFlagger } from "@/components/mistakes/WordFlagger";
import {
  EntryStatus,
  PageCalc,
  ReasonBox,
  SESSION_TYPE_LABEL,
  SessionTypePills,
  SurahRangeFields,
  recitationStyles as rs,
  useRecitationEntry,
} from "@/components/recitation/RecitationEntry";
import { deleteSessionAction, resolveMistakeAction, saveSessionAction } from "./actions";

type Quality = "EXCELLENT" | "GOOD" | "NEEDS_REPEAT";
const QUALITY_LABEL: Record<Quality, string> = { EXCELLENT: "متقن (بدون أخطاء)", GOOD: "جيد", NEEDS_REPEAT: "يحتاج إعادة" };
const DAY_LABEL = ["اليوم", "أمس", "قبل يومين"];

const round1 = (n: number) => Math.round(n * 10) / 10;

export function RafiqHome({ data, gender, commitment }: { data: MemorizationView; gender: PersonGender; commitment: CommitmentData }) {
  const router = useRouter();
  const today = useToday();
  const p = (m: string, f: string) => pickByPerson(gender, { m, f });
  const subject: RecitationSubject = useMemo(() => ({ self: gender }), [gender]);

  const entry = useRecitationEntry({
    plan: data.plan,
    position: data.position,
    reach: data.reach,
    memorizedRanges: data.memorizedRanges,
    subject,
  });
  const { surahNumber, fromAyah, toAyah, sessionType, classification, pageResult, isNew } = entry;
  const hasRangeError = "error" in pageResult;
  const [quality, setQuality] = useState<Quality | "">("");
  const [dayIndex, setDayIndex] = useState(0);
  const [notes, setNotes] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const saveDisabled = hasRangeError || (entry.requiresReason && !entry.reasonFilled) || pending || !today;

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2400);
  }

  function save() {
    if (!today) return;
    setSaveError(null);
    const day = loggableDays(today)[dayIndex];
    startTransition(async () => {
      const r = await saveSessionAction({ ...entry.entryInput(), quality: quality || null, notes, day, today });
      if (r.error) return setSaveError(r.error);
      setNotes("");
      setQuality("");
      setDayIndex(0);
      router.refresh();
      entry.afterSave();
      flash(
        !isNew
          ? `تم حفظ جلسة ال${SESSION_TYPE_LABEL[sessionType]} ✓`
          : classification.situation === "SURAH_GAP" || classification.situation === "AYAH_GAP"
            ? "تم الحفظ مع تسجيل سبب التجاوز ✓"
            : "تم حفظ الجلسة ✓",
      );
    });
  }

  function startReview(surah: number) {
    entry.startReview(surah);
    document.getElementById("record")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const quranPercent = Math.min(100, Math.round((data.memorizedPages / TOTAL_PAGES) * 1000) / 10);
  const ayahCount = AYAH_COUNT[surahNumber];

  return (
    <div>
      {/* where she stands */}
      <div className={styles.position}>
        <div className={styles.icon}>📖</div>
        <div>
          <div className={styles.label}>موضعك الحالي (حسب خطتك)</div>
          <div className={styles.value}>
            {data.position
              ? `${SURAH_NAME[data.position.surahNumber]} — الآية ${data.position.ayah} من ${AYAH_COUNT[data.position.surahNumber]}`
              : `لم ${p("تبدأ", "تبدئي")} بعد — أول سورة في خطتك: ${SURAH_NAME[data.plan[0]]}`}
          </div>
        </div>
      </div>

      {/* progress, prominent */}
      <div className={styles.progressCard}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statNum}>{round1(data.memorizedPages)}</div>
            <div className={styles.statLbl}>صفحة محفوظة</div>
          </div>
          <div className={`${styles.stat} ${styles.sage}`}>
            <div className={styles.statNum}>{quranPercent}٪</div>
            <div className={styles.statLbl}>من القرآن كاملًا ({TOTAL_PAGES} صفحة)</div>
          </div>
          <div className={`${styles.stat} ${styles.gold}`}>
            <div className={styles.statNum}>{data.loggedSessions}</div>
            <div className={styles.statLbl}>{data.loggedSessions === 0 ? "لا جلسات بعد" : `جلسة · ${round1(data.recitedPages)} صفحة مسمَّعة`}</div>
          </div>
        </div>
        <div className={styles.bars}>
          {data.progressBars.map((bar) => (
            <div key={bar.key}>
              <div className={styles.barHead}>
                <span className={styles.barLabel}>{bar.label}</span>
                <span className={styles.barDetail}>
                  {bar.detail} · {bar.percent}٪
                </span>
              </div>
              <div
                className={styles.barTrack}
                role="progressbar"
                aria-label={bar.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={bar.percent}
              >
                <div className={styles.barFill} style={{ width: `${bar.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <CommitCard commitment={commitment} today={today} />

      {/* recording a session */}
      <div className={styles.secTitle} id="record">
        تسجيل جلسة
      </div>
      <div className={styles.recordCard}>
        <SessionTypePills entry={entry} />
        <div className={rs.fieldRow}>
          <SurahRangeFields entry={entry} />
          <div className={rs.field}>
            <label htmlFor="quality">مستوى التسميع (اختياري)</label>
            <select id="quality" value={quality} onChange={(e) => setQuality(e.target.value as Quality | "")}>
              <option value="">— بدون تقييم —</option>
              {(Object.keys(QUALITY_LABEL) as Quality[]).map((q) => (
                <option key={q} value={q}>
                  {QUALITY_LABEL[q]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={rs.fieldRow}>
          <div className={rs.field}>
            <label>تاريخ الجلسة</label>
            <div className={styles.dayPills} role="radiogroup" aria-label="تاريخ الجلسة">
              {DAY_LABEL.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={dayIndex === i}
                  className={`${styles.dayPill} ${dayIndex === i ? styles.sel : ""}`}
                  onClick={() => setDayIndex(i)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={rs.field} style={{ flex: 2 }}>
            <label htmlFor="notesField">ملاحظات (اختياري)</label>
            <input id="notesField" type="text" maxLength={300} placeholder="أي ملاحظة عن هذه الجلسة..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <EntryStatus entry={entry} positionOf="موضعك" confirmVerb={p("تأكّد", "تأكّدي")} />

        {!hasRangeError && (
          <WordFlagger
            surahNumber={surahNumber}
            fromAyah={fromAyah}
            toAyah={toAyah}
            startCollapsed={pageResult.totalPages > 3}
            flags={entry.wordFlags}
            onChange={entry.setWordFlags}
            subject={subject}
          />
        )}

        <ReasonBox entry={entry} placeholder="مثال: تجاوزتُ هذه الآيات لأنني أحفظها مسبقًا..." />

        {saveError && <div className={styles.err}>{saveError}</div>}
        {!saveError && hasRangeError && <div className={styles.err}>{(pageResult as { error: string }).error}</div>}

        <PageCalc surahNumber={surahNumber} pageResult={pageResult} />

        <button className={rs.saveBtn} onClick={save} disabled={saveDisabled} type="button">
          {pending ? "جارٍ الحفظ..." : "حفظ الجلسة"}
        </button>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>{ayahCount ? `تحتوي السورة على ${ayahCount} آية` : ""}</div>
      </div>

      {data.mistakes.length > 0 && (
        <Collapsible title="🔖 كلمات تحتاج مراجعة" tag={countLabel(data.mistakes.length, WORDS)} persistKey="rafiq.mistakes">
          <MistakesList
            mistakes={data.mistakes}
            subject={subject}
            onResolve={async (m) => {
              const r = await resolveMistakeAction(m.surahNumber, m.ayah, m.wordPosition);
              if (!("error" in r)) router.refresh();
              return r;
            }}
          />
        </Collapsible>
      )}

      {data.overdue.length > 0 && (
        <Collapsible title="🔁 سور تحتاج مراجعة" tag={countLabel(data.overdue.length, SURAHS_COUNT)} persistKey="rafiq.review">
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 8 }}>
            لم تُراجع كاملةً منذ أكثر من {countLabel(data.reviewReminderDays ?? 0, DAYS_AFTER_PREP)}
          </div>
          {data.overdue.map((o) => (
            <button key={o.surahNumber} type="button" className={styles.reviewRow} onClick={() => startReview(o.surahNumber)}>
              <span className={styles.reviewSurah}>{SURAH_NAME[o.surahNumber]}</span>
              <span className={styles.reviewMeta}>
                {o.neverReviewed ? "لم تُراجع منذ الإتمام" : "أقدم جزء رُوجع في"} <bdi dir="ltr">{o.since}</bdi> · منذ {countLabel(o.daysSince, DAYS_AFTER_PREP)}
              </span>
              <span className={styles.reviewAction}>تسجيل مراجعة ←</span>
            </button>
          ))}
        </Collapsible>
      )}

      <History data={data} p={p} />

      {toast && (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

const WEEK_MARK = { done: "✓", missed: "✗", off: "—", today: "•", future: "", before: "" } as const;

/** Her streak of commitment days and this week, worked out on her local today. */
function CommitCard({ commitment, today }: { commitment: CommitmentData; today: string | null }) {
  if (!today) return <div className={styles.commitCard} style={{ minHeight: 70 }} aria-busy />;
  const logged = new Set(commitment.loggedDays);
  const { current, best } = computeStreak(commitment.schedule, logged, today, commitment.start);
  const week = weekView(commitment.schedule, logged, today, commitment.start);
  return (
    <div className={styles.commitCard}>
      <div>
        <div className={styles.streakNum}>🔥 {current}</div>
        <div className={styles.streakLbl}>
          {current === 0 ? "لا أيام التزام متتالية بعد" : `${streakDaysText(current)} من الالتزام المتتالي`}
          {best > current && ` · الأفضل: ${streakDaysText(best)}`}
        </div>
        <Link href="/rafiq/settings#commit" className={styles.linkBtn} style={{ display: "inline-block", marginTop: 4 }}>
          أيام الالتزام
        </Link>
      </div>
      <div className={styles.week} aria-label="هذا الأسبوع">
        {week.map((w) => (
          <div key={w.day} className={`${styles.weekDay} ${styles[w.state]}`} title={w.day}>
            {WEEKDAY_SHORT[weekdayOf(w.day)]}
            <b>{WEEK_MARK[w.state]}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function History({ data, p }: { data: MemorizationView; p: (m: string, f: string) => string }) {
  const router = useRouter();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const logged = data.history.filter((h) => h.source === "LOGGED");

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await deleteSessionAction(id);
      if (r.error) return setError(r.error);
      setConfirmId(null);
      router.refresh();
    });
  }

  return (
    <Collapsible
      title="سجل الجلسات"
      tag={logged.length === 0 ? "لا توجد جلسات بعد" : `${countLabel(logged.length, SESSIONS)} · آخرها ${logged[0].day}`}
      persistKey="rafiq.history"
    >
      {data.history.length === 0 ? (
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--ink-soft)", padding: "12px 0" }}>
          لا توجد جلسات بعد — {p("سجّل", "سجّلي")} أول جلسة من الأعلى
        </div>
      ) : (
        data.history.map((h) => (
          <div key={h.id} className={styles.historyRow}>
            <div className={styles.historyDay}>
              <bdi dir="ltr">{h.day}</bdi>
            </div>
            <div className={styles.historyBody}>
              <div className={styles.historyTitle}>
                {SURAH_NAME[h.surahNumber]} — آية {h.fromAyah} إلى {h.toAyah}
              </div>
              <div className={styles.badges}>
                {h.source === "PRIOR" ? (
                  <span className={styles.badge}>📚 حفظ سابق</span>
                ) : (
                  <>
                    <span className={`${styles.badge} ${h.type !== "NEW" ? styles.gold : ""}`}>
                      {h.type === "NEW" ? "حفظ جديد" : `↺ ${SESSION_TYPE_LABEL[h.type]}`}
                    </span>
                    {h.quality && <span className={styles.badge}>{QUALITY_LABEL[h.quality]}</span>}
                    {h.mistakes > 0 && <span className={styles.badge}>🔖 {countLabel(h.mistakes, WORDS)}</span>}
                  </>
                )}
                <span className={styles.badge}>{h.pages} صفحة</span>
              </div>
              {h.reason && <div className={styles.historyReason}>سبب: {h.reason}</div>}
              {h.notes && <div className={styles.historyNote}>&quot;{h.notes}&quot;</div>}
              {confirmId === h.id ? (
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>حذف هذه الجلسة وكلماتها المحدّدة؟</span>
                  <button type="button" className={styles.linkDanger} disabled={pending} onClick={() => remove(h.id)}>
                    تأكيد الحذف
                  </button>
                  <button type="button" className={styles.linkBtn} onClick={() => setConfirmId(null)}>
                    تراجع
                  </button>
                </div>
              ) : (
                <button type="button" className={styles.linkDanger} onClick={() => setConfirmId(h.id)}>
                  حذف
                </button>
              )}
              {confirmId === h.id && error && <div className={styles.err}>{error}</div>}
            </div>
          </div>
        ))
      )}
    </Collapsible>
  );
}
