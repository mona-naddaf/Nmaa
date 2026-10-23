"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import hl from "@/components/home-log/home-log.module.css";
import work from "@/components/student-work/work.module.css";
import { WeekdayPicker } from "@/components/student-work/TrackerControls";
import { PriorPicker, usePriorState } from "@/components/plan/PriorPicker";
import { CityPicker } from "@/components/prayer/CityPicker";
import { LeaveGuard, trackSave } from "@/components/leave-guard/LeaveGuard";
import { SavedNote } from "@/components/nudge/SavedNote";
import { pointTo } from "@/components/nudge/nudge";
import { localToday } from "@/lib/home-log/rules";
import { daysLabel } from "@/lib/tracker/rules";
import { templateSurahs } from "@/lib/students/new-student";
import type { PrayerLocation } from "@/lib/prayer/times";
import { pickByPerson, type PersonGender } from "@/lib/text/gender";
import { landing, nextScreen, prevScreen, presetLabel, questionOf, REVIEW_DEFAULT, reviewChoices, type Branch, type Screen } from "@/lib/guide/wizard";
import { startTexts, type PlanChoice } from "@/lib/guide/start-texts";
import { useGuide } from "../GuideProvider";
import { addPriorAction, savePlanAction } from "../actions";
import { setAgendaEnabledAction, setCommitDaysAction, setPlaceAction, setReviewRemindersAction } from "../settings/actions";
import { applyTemplateAction } from "../templates/actions";
import s from "./start.module.css";

// The setup questions (review page ١): one screen at a time; «التالي» is the
// only button that saves, each answer at once, through the same actions as
// «خطتي», «الإعدادات» and the template bank. Nothing here removes or turns
// off anything she has: a saved plan is only linked to, and «لا» saves nothing.
// Where to resume is kept in wizard.step, the end in wizard.done.

type BankCard = { id: string; title: string; description: string | null; suggested: boolean; items: { title: string; days: number }[] };

type Props = {
  gender: PersonGender;
  name: string | null;
  done: boolean;
  step: number | null;
  planTemplate: string | null;
  plan: number[];
  priorSurahs: number;
  commitDays: number;
  commitLabel: string;
  trackerItems: number;
  agendaEnabled: boolean;
  place: PrayerLocation | null;
  reviewDays: number | null;
  bank: BankCard[];
};

type Result = { error?: string } | null | undefined;

const samePlace = (a: PrayerLocation | null, b: PrayerLocation | null) => JSON.stringify(a) === JSON.stringify(b);

export function StartWizard(props: Props) {
  const { gender } = props;
  const t = startTexts(gender);
  const router = useRouter();
  const guide = useGuide();

  // a plan saved on this page, before the server's data catches up
  const [planHere, setPlanHere] = useState<number[] | null>(null);
  const plan = props.plan.length > 0 ? props.plan : (planHere ?? []);
  const facts = { hasPlan: props.planTemplate !== null || planHere !== null, bankCount: props.bank.length };

  const [screen, setScreen] = useState<Screen>(() => landing({ done: props.done, step: props.step, facts }));
  const [history, setHistory] = useState<Screen[]>([]);
  // the furthest question reached, as saved in wizard.step
  const reached = useRef(props.step ?? 1);

  // the answers, kept when going back and forth
  const [planChoice, setPlanChoice] = useState<PlanChoice | null>(null);
  const [custom, setCustom] = useState(false);
  const [hasPrior, setHasPrior] = useState<"yes" | "no" | null>(null);
  const prior = usePriorState();
  const [days, setDays] = useState(props.commitDays);
  const [tracker, setTracker] = useState<"yes" | "no" | null>(null);
  const [startWith, setStartWith] = useState<"ready" | "empty" | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [withTimes, setWithTimes] = useState<"yes" | "no" | null>(props.agendaEnabled ? "yes" : null);
  const [timing, setTiming] = useState<"prayer" | "hours" | null>(props.agendaEnabled ? (props.place ? "prayer" : "hours") : null);
  const [city, setCity] = useState<PrayerLocation | null>(props.place);
  const [review, setReview] = useState<"yes" | "no" | null>(props.reviewDays !== null ? "yes" : null);
  const [reviewDays, setReviewDays] = useState(props.reviewDays ?? REVIEW_DEFAULT);
  const [skippedReview, setSkippedReview] = useState(false);

  // what the screen says about the last step: a line carried over, «تم الحفظ ✓», a failure, what's missing
  const [notice, setNotice] = useState<string | null>(null);
  // «تم الحفظ ✓»: shown for the latest save (a count, so each save shows it anew), hidden otherwise
  const [savedCount, setSavedCount] = useState(0);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  const heading = useRef<HTMLHeadingElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const missingLine = useRef<HTMLParagraphElement>(null);
  const undecided = useRef<HTMLParagraphElement>(null);
  const first = useRef(true);

  // a new screen: its heading takes focus, so a screen reader reads the question
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [screen]);

  const q = questionOf(screen);

  function clearLines() {
    setMissing(null);
    setError(null);
  }

  /** «التالي» with something missing: the line under the choices, flashed, and focus on the first choice. */
  function showMissing(text: string | null, target: HTMLElement | null = group.current) {
    setMissing(text);
    setError(null);
    window.requestAnimationFrame(() => {
      const line = text ? missingLine.current : undecided.current;
      if (line) pointTo(line, { focus: false });
      target?.querySelector<HTMLElement>("input, button, select")?.focus({ preventScroll: true });
    });
  }

  function remember(next: Screen) {
    const nq = next === "done" ? null : questionOf(next);
    if (next === "done") void guide.mark("wizard.done");
    else if (nq !== null && nq > reached.current) {
      reached.current = nq;
      void guide.mark("wizard.step", { q: nq });
    }
  }

  function advance(next: Screen, line: string | null = null, saved = false) {
    remember(next);
    setHistory((h) => [...h, screen]);
    setScreen(next);
    clearLines();
    setNotice(line);
    if (saved && !line) setSavedCount((n) => n + 1);
    setShowSaved(saved && !line);
  }

  function back() {
    const prev = history.length > 0 ? history[history.length - 1] : prevScreen(screen, facts);
    setHistory((h) => h.slice(0, -1));
    setScreen(prev);
    clearLines();
    setNotice(null);
    setShowSaved(false);
  }

  /** Runs the saves of one «التالي»; false when one failed (its message is shown). */
  async function run(...saves: (() => Promise<Result>)[]): Promise<boolean> {
    for (const save of saves) {
      const r = await trackSave(save()).catch(() => ({ error: t.saveError }));
      if (r?.error) {
        setError(r.error);
        return false;
      }
    }
    return true;
  }

  // «التالي»: never inactive; a second press while saving does nothing
  async function onNext() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      await next();
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function next() {
    const today = localToday();
    const go = (branch: Branch = {}, line: string | null = null, saved = false) => advance(nextScreen(screen, facts, branch), line, saved);

    switch (screen) {
      case "welcome":
        return go();
      case "q1": {
        if (!planChoice) return showMissing(null);
        if (planChoice === "custom") {
          setCustom(true);
          return go();
        }
        const surahs = templateSurahs(planChoice);
        if (!(await run(() => savePlanAction({ template: planChoice, plan: surahs, today })))) return;
        setPlanHere(surahs);
        // the prior question follows now that there is a plan
        return advance("q2", null, true);
      }
      case "q2": {
        if (!hasPrior) return showMissing(t.q2.missing);
        if (hasPrior === "no") return go();
        const value = prior.value({ always: true, pendingRangeOf: plan });
        if (value.completedSurahs.length === 0 && !value.partial) return showMissing(t.q2.empty);
        if (!(await run(() => addPriorAction({ prior: value, today })))) return;
        prior.reset();
        prior.setRangeFrom(null);
        prior.setRangeTo(null);
        return go({}, t.q2.saved, true);
      }
      case "q3": {
        if (days === props.commitDays) return go();
        if (!(await run(() => setCommitDaysAction({ days, today })))) return;
        return go({}, null, true);
      }
      case "q4": {
        if (!tracker) return showMissing(t.q4.missing);
        if (tracker === "no") {
          if (!(await run(() => guide.mark("checklist.noTracker")))) return;
          return go({ tracker }, null, true);
        }
        return go({ tracker });
      }
      case "q4a": {
        if (!startWith) return showMissing(t.q4a.missing);
        if (startWith === "empty") return go();
        if (!template) return showMissing(t.q4a.noCard, document.getElementById("start-cards"));
        let added = { added: 0, skipped: 0 };
        const ok = await run(async () => {
          const r = await applyTemplateAction(template);
          added = { added: r.added ?? 0, skipped: r.skipped ?? 0 };
          return r;
        });
        if (!ok) return;
        // the bank's own action refreshes the bank and the tracker, not this page
        router.refresh();
        return go({}, t.q4a.added(added.added, added.skipped));
      }
      case "q4b":
        if (!withTimes) return showMissing(t.q4b.missing);
        // «لا» leaves «الجدول اليومي» as it is
        return go({ withTimes });
      case "q4c": {
        if (!timing) return showMissing(t.q4c.missing);
        const agenda = () => send(setAgendaEnabledAction, { on: "1" });
        if (timing === "hours") {
          if (props.agendaEnabled) return go();
          if (!(await run(agenda))) return;
          return go({}, null, true);
        }
        if (!city) return showMissing(t.q4c.noCity, document.getElementById("start-city"));
        const saves = [...(samePlace(city, props.place) ? [] : [() => setPlaceAction(city)]), ...(props.agendaEnabled ? [] : [agenda])];
        if (saves.length === 0) return go();
        if (!(await run(...saves))) return;
        return go({}, null, true);
      }
      case "q5": {
        if (!review) return showMissing(t.q5.missing);
        // «لا، شكرًا» saves nothing: reminders are turned off in «الإعدادات» only
        if (review === "no" || reviewDays === props.reviewDays) return go();
        if (!(await run(() => send(setReviewRemindersAction, { on: "1", days: String(reviewDays) })))) return;
        return go({}, null, true);
      }
      case "done":
        return;
    }
  }

  function skip() {
    if (busy.current) return;
    if (screen === "q1" && !facts.hasPlan) return advance(nextScreen(screen, facts), t.q1.skipNote);
    if (screen === "q5") setSkippedReview(props.reviewDays === null);
    advance(nextScreen(screen, facts));
  }

  // «إكمال الأسئلة لاحقًا»: what was saved stays; the choice on this screen isn't saved
  async function later() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    if (q !== null && q > reached.current) {
      reached.current = q;
      await guide.mark("wizard.step", { q });
    }
    router.push("/rafiq?later=1");
  }

  // «فتح «خطتي»»: her answer to the plan question is to change it there
  async function openPlan() {
    if (busy.current) return;
    busy.current = true;
    if (reached.current < 2) {
      reached.current = 2;
      await guide.mark("wizard.step", { q: 2 });
    }
    router.push("/rafiq/plan");
  }

  const nextLabel = saving ? t.saving : t.next;

  return (
    <div className={s.wrap}>
      <LeaveGuard you={gender} />
      {/* outside the screen, so they stay in place and are announced when they change */}
      <div role="status" className={s.status}>
        {notice && <p className={hl.ok}>{notice}</p>}
        {saving && <span className={s.srOnly}>{t.saving}</span>}
      </div>
      <SavedNote stamp={showSaved ? savedCount : 0} className={s.saved} />
      <section key={screen} className={`${hl.section} ${s.screen}`} aria-labelledby="start-title" aria-busy={saving || undefined}>
        {q !== null && <p className={s.progress}>{t.progress(q)}</p>}

        {screen === "welcome" && (
          <>
            <h1 id="start-title" ref={heading} tabIndex={-1} className={s.title}>
              {t.welcome.title(props.name)}
            </h1>
            <p className={s.text}>{t.welcome.body}</p>
            <p className={s.text}>{t.welcome.skipHint}</p>
          </>
        )}

        {screen === "q1" &&
          (facts.hasPlan ? (
            <>
              <h1 id="start-title" ref={heading} tabIndex={-1} className={s.title}>
                {t.q1.title}
              </h1>
              <p className={s.text}>{t.q1.current(props.planTemplate ?? (planChoice ? planTemplateOf(planChoice) : "CUSTOM"))}</p>
            </>
          ) : (
            <>
              <h1 id="start-title" ref={heading} tabIndex={-1} className={s.title}>
                {t.q1.title}
              </h1>
              <p className={s.text}>{t.q1.intro}</p>
              <Choices name="plan" value={planChoice} onChange={(v) => (setPlanChoice(v), clearLines())} options={t.q1.options.map((o) => ({ value: o.key, label: o.label, desc: o.desc, meta: o.meta }))} groupRef={group} />
              <p ref={undecided} className={s.note}>
                {t.q1.undecided}
              </p>
              {planChoice === "custom" && <p className={s.note}>{t.q1.customNote}</p>}
            </>
          ))}

        {screen === "q2" && (
          <>
            <h1 id="start-title" ref={heading} tabIndex={-1} className={s.title}>
              {t.q2.title}
            </h1>
            <p className={s.text}>{t.q2.intro}</p>
            <Choices
              name="prior"
              value={hasPrior}
              onChange={(v) => (setHasPrior(v), clearLines())}
              options={[
                { value: "yes", label: t.q2.yes },
                { value: "no", label: t.q2.no },
              ]}
              groupRef={group}
            />
            {hasPrior === "yes" && (
              <div className={s.sub}>
                <p className={s.text}>{t.q2.afterYes}</p>
                <PriorPicker
                  plan={plan}
                  prior={prior}
                  alwaysOpen
                  // the same words as «خطتي» (none / yes aren't shown: always open)
                  words={{ none: "لا يوجد حفظ سابق", yes: "نعم، حفظتُ أجزاءً من قبل", planOf: "خطتك", choose: pickByPerson(gender, { m: "اختر", f: "اختاري" }), partialWho: pickByPerson(gender, { m: "تحفظ منها", f: "تحفظين منها" }) }}
                />
              </div>
            )}
          </>
        )}

        {screen === "q3" && (
          <>
            <h1 id="start-title" ref={heading} tabIndex={-1} className={s.title}>
              {t.q3.title}
            </h1>
            <p className={s.text}>{t.q3.intro}</p>
            <div ref={group}>
              <WeekdayPicker days={days} onChange={(d) => (setDays(d), clearLines())} onEmpty={() => showMissing(t.q3.atLeastOne)} />
            </div>
            <p className={s.note}>{t.q3.note}</p>
          </>
        )}

        {screen === "q4" && (
          <>
            <h1 id="start-title" ref={heading} tabIndex={-1} className={s.title}>
              {t.q4.title}
            </h1>
            <p className={s.text}>{t.q4.intro}</p>
            <Choices
              name="tracker"
              value={tracker}
              onChange={(v) => (setTracker(v), clearLines())}
              options={[
                { value: "yes", label: t.q4.yes },
                { value: "no", label: t.q4.no },
              ]}
              groupRef={group}
            />
          </>
        )}

        {screen === "q4a" && (
          <>
            <h1 id="start-title" ref={heading} tabIndex={-1} className={s.title}>
              {t.q4a.title}
            </h1>
            <Choices
              name="startWith"
              value={startWith}
              onChange={(v) => (setStartWith(v), clearLines())}
              options={[
                { value: "ready", label: t.q4a.ready, desc: t.q4a.readyDesc },
                { value: "empty", label: t.q4a.empty, desc: t.q4a.emptyDesc },
              ]}
              groupRef={group}
            />
            {startWith === "ready" && (
              <div id="start-cards" className={s.cards}>
                {props.bank.map((c) => {
                  const chosen = template === c.id;
                  const open = openCard === c.id;
                  return (
                    <div key={c.id} className={`${s.card} ${chosen ? s.chosen : ""}`}>
                      <div className={s.cardHead}>
                        <b>{c.title}</b>
                        {c.suggested && <span className={`${work.tag} ${work.green}`}>{t.q4a.suggested}</span>}
                      </div>
                      {c.description && <p className={s.cardDesc}>{c.description}</p>}
                      <div className={hl.actionsRow}>
                        <button type="button" className={hl.linkBtn} aria-expanded={open} onClick={() => setOpenCard(open ? null : c.id)}>
                          {open ? t.q4a.hide : t.q4a.show}
                        </button>
                        <button
                          type="button"
                          className={chosen ? hl.primaryBtn : hl.ghostBtn}
                          aria-pressed={chosen}
                          onClick={() => {
                            setTemplate(c.id);
                            clearLines();
                          }}
                        >
                          {chosen ? t.q4a.chosen : t.q4a.choose}
                        </button>
                      </div>
                      {open && (
                        <ul className={s.items}>
                          {c.items.map((it, i) => (
                            <li key={i}>
                              {it.title} — <span className={hl.muted}>{daysLabel(it.days)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {screen === "q4b" && (
          <>
            <h1 id="start-title" ref={heading} tabIndex={-1} className={s.title}>
              {t.q4b.title}
            </h1>
            <p className={s.text}>{t.q4b.intro}</p>
            <Choices
              name="withTimes"
              value={withTimes}
              onChange={(v) => (setWithTimes(v), clearLines())}
              options={[
                { value: "yes", label: t.q4b.yes },
                { value: "no", label: t.q4b.no },
              ]}
              groupRef={group}
            />
          </>
        )}

        {screen === "q4c" && (
          <>
            <h1 id="start-title" ref={heading} tabIndex={-1} className={s.title}>
              {t.q4c.title}
            </h1>
            <Choices
              name="timing"
              value={timing}
              onChange={(v) => (setTiming(v), clearLines())}
              options={[
                { value: "prayer", label: t.q4c.prayer, desc: t.q4c.prayerDesc },
                { value: "hours", label: t.q4c.hours, desc: t.q4c.hoursDesc },
              ]}
              groupRef={group}
            />
            {timing === "prayer" && (
              <div id="start-city" className={s.sub}>
                <CityPicker initial={props.place} previewZone={null} intro={t.q4c.city} onSave={setPlaceAction} onDraft={(c) => (setCity(c), c && clearLines())} />
              </div>
            )}
            {timing === "hours" && <p className={s.note}>{t.q4c.hoursNote}</p>}
          </>
        )}

        {screen === "q5" && (
          <>
            <h1 id="start-title" ref={heading} tabIndex={-1} className={s.title}>
              {t.q5.title}
            </h1>
            <p className={s.text}>{t.q5.intro}</p>
            <Choices
              name="review"
              value={review}
              onChange={(v) => (setReview(v), clearLines())}
              options={[
                { value: "yes", label: t.q5.yes },
                { value: "no", label: t.q5.no },
              ]}
              groupRef={group}
            />
            {review === "yes" && (
              <div className={s.sub}>
                <p className={s.text} id="start-review-days">
                  {t.q5.after}
                </p>
                <div className={work.pills} role="radiogroup" aria-labelledby="start-review-days">
                  {reviewChoices(props.reviewDays).map((n) => (
                    <label key={n} className={`${work.pill} ${s.pillChoice} ${reviewDays === n ? work.sel : ""}`}>
                      <input type="radio" name="reviewDays" className={s.srOnlyInput} checked={reviewDays === n} onChange={() => setReviewDays(n)} />
                      {presetLabel(n)}
                    </label>
                  ))}
                </div>
                <p className={s.note}>{t.q5.inSiteOnly}</p>
                <p className={s.note}>{t.q5.startsLater}</p>
              </div>
            )}
          </>
        )}

        {screen === "done" && (
          <>
            <h1 id="start-title" ref={heading} tabIndex={-1} className={s.title}>
              {t.done.title}
            </h1>
            <p className={s.text}>{t.done.lead}</p>
            <ul className={s.summary}>
              {t.done
                .lines({
                  planTemplate: props.planTemplate,
                  priorSurahs: props.priorSurahs,
                  commitDays: props.commitLabel,
                  trackerItems: props.trackerItems,
                  agenda: props.agendaEnabled,
                  city: props.place?.name ?? null,
                  reviewDays: props.reviewDays,
                })
                .map((line) => (
                  <li key={line}>{line}</li>
                ))}
            </ul>
            {skippedReview && props.reviewDays === null && <p className={s.text}>{t.done.skipped}</p>}
            <p className={s.text}>{t.done.help}</p>
          </>
        )}

        {missing && (
          <p ref={missingLine} className={hl.err} role="alert">
            {missing}
          </p>
        )}
        {error && (
          <p className={hl.err} role="alert">
            {error}
          </p>
        )}

        <div className={s.nav}>
          {screen === "welcome" && (
            <>
              <button type="button" className={hl.primaryBtn} onClick={onNext}>
                {t.welcome.start}
              </button>
              <button type="button" className={hl.ghostBtn} onClick={later}>
                {t.later}
              </button>
            </>
          )}
          {screen === "q1" && facts.hasPlan && (
            <>
              <button type="button" className={hl.primaryBtn} onClick={() => advance(nextScreen("q1", facts))}>
                {t.q1.keep}
              </button>
              <button type="button" className={hl.ghostBtn} onClick={openPlan}>
                {t.q1.open}
              </button>
              <button type="button" className={hl.ghostBtn} onClick={back}>
                {t.back}
              </button>
              <button type="button" className={hl.linkBtn} onClick={later}>
                {t.later}
              </button>
            </>
          )}
          {q !== null && !(screen === "q1" && facts.hasPlan) && (
            <>
              <button type="button" className={hl.primaryBtn} onClick={onNext}>
                {nextLabel}
              </button>
              <button type="button" className={hl.ghostBtn} onClick={back}>
                {t.back}
              </button>
              <button type="button" className={hl.ghostBtn} onClick={skip}>
                {t.skip}
              </button>
              <button type="button" className={hl.linkBtn} onClick={later}>
                {t.later}
              </button>
            </>
          )}
          {screen === "done" &&
            (facts.hasPlan ? (
              <Link href="/rafiq" className={hl.primaryBtn}>
                {t.done.home}
              </Link>
            ) : (
              <Link href={custom ? "/rafiq/plan?from=start" : "/rafiq/plan"} className={hl.primaryBtn}>
                {t.done.toPlan}
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}

const PLAN_TEMPLATE: Record<PlanChoice, string> = { mushafrev: "MUSHAF_REVERSE", mushaf: "MUSHAF_ORDER", juzamma: "JUZ_AMMA_REVERSE", custom: "CUSTOM" };
const planTemplateOf = (c: PlanChoice) => PLAN_TEMPLATE[c];

type FormAction = (prev: null, formData: FormData) => Promise<Result>;

/** Calls a settings action the way its form does. */
function send(action: FormAction, fields: Record<string, string>): Promise<Result> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return action(null, fd);
}

/** One question's choices: native radios (arrow keys, read as a group), shown as cards. */
function Choices<T extends string>({
  name,
  value,
  onChange,
  options,
  groupRef,
}: {
  name: string;
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string; desc?: string; meta?: string }[];
  groupRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={groupRef} role="radiogroup" aria-labelledby="start-title" className={s.opts}>
      {options.map((o) => (
        <label key={o.value} className={`${s.opt} ${value === o.value ? s.sel : ""}`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>
            <b>{o.label}</b>
            {o.desc && <small>{o.desc}</small>}
            {o.meta && <small>{o.meta}</small>}
          </span>
        </label>
      ))}
    </div>
  );
}
