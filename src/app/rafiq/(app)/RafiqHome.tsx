"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "../rafiq.module.css";
import { AYAH_COUNT, SURAH_NAME, TOTAL_PAGES } from "@/lib/quran-data";
import type { RecitationSubject } from "@/lib/recitation/logic";
import type { MemorizationView } from "@/lib/rafiq/memorization";
import type { CommitmentData } from "@/lib/rafiq/commitment";
import { commitStart, computeStreak, streakDaysText, weekView } from "@/lib/rafiq/streak";
import { WEEKDAY_SHORT, weekdayOf } from "@/lib/tracker/rules";
import Link from "next/link";
import { loggableDays } from "@/lib/rafiq/days";
import { dayOfInstant, useToday } from "@/lib/calendar/useToday";
import { overdueFrom } from "@/lib/students/review";
import { pickByPerson, type PersonGender } from "@/lib/text/gender";
import { DAYS_AFTER_PREP, SESSIONS, SURAHS_COUNT, WORDS, countLabel } from "@/lib/text/count";
import { Collapsible } from "@/components/collapsible/Collapsible";
import { GoalLine } from "@/components/goal/GoalLine";
import { computeGoal } from "@/lib/goals/goal";
import { MistakesList } from "@/components/mistakes/MistakesList";
import { WordFlagger } from "@/components/mistakes/WordFlagger";
import { TajweedSummaryBlock } from "@/components/mistakes/TajweedSummaryBlock";
import { mistakeWordCount } from "@/lib/students/mistake-types";
import type { TajweedSummary } from "@/lib/tajweed/summary";
import { VerseNoteMarker } from "./notes/NotesProvider";
import { SimilarScope } from "./SimilarScope";
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
import { deleteSessionAction, resolveMistakeAction, saveSessionAction, setSessionQualityAction } from "./actions";
import { canDeleteSession, recordedByLine, scopeCan, selfAssessed, SELF_SCOPE, type RafiqScope } from "@/lib/rafiq/scope";
import { LeaveGuard, trackSave } from "@/components/leave-guard/LeaveGuard";

type Quality = "EXCELLENT" | "GOOD" | "NEEDS_REPEAT";
const QUALITY_LABEL: Record<Quality, string> = { EXCELLENT: "متقن (بدون أخطاء)", GOOD: "جيد", NEEDS_REPEAT: "يحتاج إعادة" };
const QUALITY_SHORT: Record<Quality, string> = { EXCELLENT: "متقن", GOOD: "جيد", NEEDS_REPEAT: "يحتاج إعادة" };
const DAY_LABEL = ["اليوم", "أمس", "قبل يومين"];

const round1 = (n: number) => Math.round(n * 10) / 10;

// similar: «المتشابهات» (her setting) — marks in the word picker
// tajweed: «أخطاء التجويد المفصّلة» (her setting) — letters and gaps in the
// word picker; tajweedSummary: its summary block (null: off or nothing yet)
// scope: «العائلة» — a child's page, for the child or an adult of her family
// (src/lib/rafiq/scope.ts); her own Rafiq page by default
export function RafiqHome({
  data,
  gender,
  commitment,
  similar = false,
  tajweed = false,
  tajweedSummary = null,
  scope = SELF_SCOPE,
}: {
  data: MemorizationView;
  gender: PersonGender;
  commitment: CommitmentData;
  similar?: boolean;
  tajweed?: boolean;
  tajweedSummary?: TajweedSummary | null;
  scope?: RafiqScope;
}) {
  const router = useRouter();
  const today = useToday();
  const p = (m: string, f: string) => pickByPerson(gender, { m, f });
  // surahs overdue for review, on her own today
  const overdue = today ? overdueFrom(data.reviewAges, data.reviewReminderDays, today) : [];
  const can = scopeCan(scope);
  // an adult on a child's page: the wording is about the child
  const child = can.aboutChild ? (scope.child ?? null) : null;
  const ofChild = (m: string, f: string) => (child?.gender === "FEMALE" ? f : m);
  // the recitation wording: about the child by name (an adult reciting with her), or «you»
  const childName = child?.name ?? null;
  const childGender = child?.gender ?? null;
  const subject: RecitationSubject = useMemo(
    () => (childName && childGender ? { child: { name: childName, gender: childGender } } : { self: gender }),
    [childName, childGender, gender],
  );

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
      const r = await saveSessionAction({ ...entry.entryInput(), quality: quality || null, notes, day, today, subjectId: scope.subjectId });
      if (r.error) return setSaveError(r.error);
      setNotes("");
      setQuality("");
      setDayIndex(0);
      router.refresh();
      entry.afterSave();
      flash(
        // «العائلة»: a warm word for a child on her own page
        scope.viewer === "child"
          ? `${p("أحسنتَ", "أحسنتِ")}! سُجّلت الجلسة ✓`
          : !isNew
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

  // her goal, by her own day (null until her browser's day is known)
  const goal = useMemo(
    () =>
      data.goal && today
        ? computeGoal(
            data.plan,
            data.goal,
            data.history.map((h) => ({ ...h, prior: h.source === "PRIOR" })),
            today,
          )
        : null,
    [data.goal, data.plan, data.history, today],
  );

  const quranPercent = Math.min(100, Math.round((data.memorizedPages / TOTAL_PAGES) * 1000) / 10);
  const ayahCount = AYAH_COUNT[surahNumber];

  return (
    <div>
      {/* where she stands */}
      <div className={styles.position}>
        <div className={styles.icon}>📖</div>
        <div>
          <div className={styles.label}>{child ? `موضع ${child.name} الحالي (حسب ${ofChild("خطته", "خطتها")})` : "موضعك الحالي (حسب خطتك)"}</div>
          <div className={styles.value}>
            {data.position
              ? `${SURAH_NAME[data.position.surahNumber]} — الآية ${data.position.ayah} من ${AYAH_COUNT[data.position.surahNumber]}`
              : child
                ? `لم ${ofChild("يبدأ", "تبدأ")} بعد — أول سورة في ${ofChild("خطته", "خطتها")}: ${SURAH_NAME[data.plan[0]]}`
                : `لم ${p("تبدأ", "تبدئي")} بعد — أول سورة في خطتك: ${SURAH_NAME[data.plan[0]]}`}
          </div>
          <GoalLine goal={goal} feminine={gender === "FEMALE"} invalidHint="الهدف لم يعد ضمن خطتك الحالية — يمكن تعديله من «خطتي»." />
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

      {(can.ownExtras || scope.streak) && (
        <CommitCard commitment={commitment} today={today} settingsHref={can.ownExtras ? "/rafiq/settings#commit" : scope.settingsHref} />
      )}

      {/* recording a session */}
      {can.record && (
      <>
      <div className={styles.secTitle} id="record">
        {child ? `التسميع مع ${child.name}` : "تسجيل جلسة"}
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

        <EntryStatus entry={entry} positionOf={child ? `موضع ${child.name}` : "موضعك"} confirmVerb={p("تأكّد", "تأكّدي")} />

        {/* word-by-word mistakes: her own page, or an adult reciting with the child */}
        {!hasRangeError && can.markWords && (
          <SimilarScope on={similar} subjectId={scope.viewer === "self" ? undefined : (scope.subjectId ?? "")}>
            <WordFlagger
              surahNumber={surahNumber}
              fromAyah={fromAyah}
              toAyah={toAyah}
              startCollapsed={pageResult.totalPages > 3}
              flags={entry.wordFlags}
              onChange={entry.setWordFlags}
              subject={subject}
              afterAyah={can.ownExtras ? (a) => <VerseNoteMarker surah={surahNumber} ayah={a} /> : undefined}
              detail={tajweed ? { enabled: true, flags: entry.detailFlags, onChange: entry.setDetailFlags } : undefined}
            />
          </SimilarScope>
        )}

        <ReasonBox
          entry={entry}
          placeholder={
            child
              ? `مثال: ${ofChild("تجاوز", "تجاوزت")} ${child.name} هذه الآيات ${ofChild("لأنه يحفظها", "لأنها تحفظها")} مسبقًا...`
              : "مثال: تجاوزتُ هذه الآيات لأنني أحفظها مسبقًا..."
          }
        />

        {saveError && <div className={styles.err}>{saveError}</div>}
        {!saveError && hasRangeError && <div className={styles.err}>{(pageResult as { error: string }).error}</div>}

        <PageCalc surahNumber={surahNumber} pageResult={pageResult} />

        <button className={rs.saveBtn} onClick={save} disabled={saveDisabled} type="button">
          {pending ? "جارٍ الحفظ..." : "حفظ الجلسة"}
        </button>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>{ayahCount ? `تحتوي السورة على ${ayahCount} آية` : ""}</div>
      </div>
      </>
      )}

      {data.mistakes.length > 0 && (
        <Collapsible title="🔖 كلمات تحتاج مراجعة" tag={countLabel(mistakeWordCount(data.mistakes), WORDS)} persistKey="rafiq.mistakes">
          <MistakesList
            mistakes={data.mistakes}
            subject={subject}
            // «العائلة»: read-only for a child and for a view-only adult
            onResolve={
              can.resolve
                ? async (m) => {
                    const r = await resolveMistakeAction(
                      m.surahNumber,
                      m.ayah,
                      m.wordPosition,
                      m.tajweed ? { letter: m.letter ?? 0, gapAfter: m.gapAfter ?? false, kind: m.tajweed.kind, code: m.tajweed.code } : undefined,
                      scope.subjectId,
                    );
                    if (!("error" in r)) router.refresh();
                    return r;
                  }
                : undefined
            }
          />
        </Collapsible>
      )}

      {tajweedSummary && (
        <Collapsible title="🎯 ملخّص أخطاء التجويد" persistKey="rafiq.tajweedSummary">
          <TajweedSummaryBlock summary={tajweedSummary} bare />
        </Collapsible>
      )}

      {overdue.length > 0 && (
        <Collapsible title="🔁 سور تحتاج مراجعة" tag={countLabel(overdue.length, SURAHS_COUNT)} persistKey="rafiq.review">
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 8 }}>
            لم تُراجع كاملةً منذ أكثر من {countLabel(data.reviewReminderDays ?? 0, DAYS_AFTER_PREP)}
          </div>
          {overdue.map((o) => (
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

      <History data={data} p={p} scope={scope} gender={gender} />
      {/* «العائلة»: an assessment change still saving when she leaves */}
      {can.assess && <LeaveGuard />}

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
// settingsHref: where the commitment days are chosen (none: the child, who doesn't choose them)
function CommitCard({ commitment, today, settingsHref }: { commitment: CommitmentData; today: string | null; settingsHref?: string }) {
  if (!today) return <div className={styles.commitCard} style={{ minHeight: 70 }} aria-busy />;
  const logged = new Set(commitment.loggedDays);
  // her first day: the local day she signed up (not the UTC one)
  const start = commitStart(commitment.loggedDays, dayOfInstant(commitment.createdAt, null));
  const { current, best } = computeStreak(commitment.schedule, logged, today, start);
  const week = weekView(commitment.schedule, logged, today, start);
  return (
    <div className={styles.commitCard}>
      <div>
        <div className={styles.streakNum}>🔥 {current}</div>
        <div className={styles.streakLbl}>
          {current === 0 ? "لا أيام التزام متتالية بعد" : `${streakDaysText(current)} من الالتزام المتتالي`}
          {best > current && ` · الأفضل: ${streakDaysText(best)}`}
        </div>
        {settingsHref && (
          <Link href={settingsHref} className={styles.linkBtn} style={{ display: "inline-block", marginTop: 4 }}>
            أيام الالتزام
          </Link>
        )}
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

function History({ data, p, scope, gender }: { data: MemorizationView; p: (m: string, f: string) => string; scope: RafiqScope; gender: PersonGender }) {
  const can = scopeCan(scope);
  const router = useRouter();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const logged = data.history.filter((h) => h.source === "LOGGED");

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await deleteSessionAction(id, scope.subjectId);
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
          {can.record ? <>لا توجد جلسات بعد — {p("سجّل", "سجّلي")} أول جلسة من الأعلى</> : "لا توجد جلسات بعد"}
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
                    {h.quality && (
                      <span className={styles.badge}>{selfAssessed(scope, h) ? `تقييم ذاتي: ${QUALITY_SHORT[h.quality]}` : QUALITY_LABEL[h.quality]}</span>
                    )}
                    {h.mistakes > 0 && <span className={styles.badge}>🔖 {countLabel(h.mistakes, WORDS)}</span>}
                  </>
                )}
                <span className={styles.badge}>{h.pages} صفحة</span>
              </div>
              {h.reason && <div className={styles.historyReason}>سبب: {h.reason}</div>}
              {h.notes && <div className={styles.historyNote}>&quot;{h.notes}&quot;</div>}
              {recordedByLine(scope, h, gender) && <div className={styles.historyNote}>{recordedByLine(scope, h, gender)}</div>}
              {can.assess && h.source === "LOGGED" && <AssessSession id={h.id} quality={h.quality} subjectId={scope.subjectId} />}
              {!canDeleteSession(scope, h) ? null : confirmId === h.id ? (
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

/**
 * «العائلة»: an adult with edit rights sets or changes the assessment of a
 * child's session. Shown at once; put back, with a short message, if saving fails.
 */
function AssessSession({ id, quality, subjectId }: { id: string; quality: Quality | null; subjectId?: string }) {
  const router = useRouter();
  const [shown, setShown] = useState<Quality | "">(quality ?? "");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [seen, setSeen] = useState(quality);
  // a refreshed page brings the saved value
  if (seen !== quality) {
    setSeen(quality);
    setShown(quality ?? "");
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, fontSize: 12 }}>
      <label htmlFor={`assess-${id}`} style={{ color: "var(--ink-soft)" }}>
        التقييم
      </label>
      <select
        id={`assess-${id}`}
        value={shown}
        onChange={(e) => {
          const before = shown;
          const next = e.target.value as Quality | "";
          setShown(next);
          setError(null);
          startTransition(async () => {
            // an error answer, or no answer at all (a dropped connection, an ended session)
            const r = await trackSave(setSessionQualityAction(id, next || null, subjectId)).catch(() => ({ error: "" }));
            if (r.error) {
              setShown(before);
              setError("تعذّر حفظ التقييم، يُرجى المحاولة مرة أخرى");
              return;
            }
            router.refresh();
          });
        }}
      >
        <option value="">— بدون تقييم —</option>
        {(Object.keys(QUALITY_LABEL) as Quality[]).map((q) => (
          <option key={q} value={q}>
            {QUALITY_SHORT[q]}
          </option>
        ))}
      </select>
      {error && <span className={styles.err} style={{ margin: 0 }}>{error}</span>}
    </div>
  );
}
