"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import hl from "@/components/home-log/home-log.module.css";
import work from "@/components/student-work/work.module.css";
import { PriorPicker, usePriorState } from "@/components/plan/PriorPicker";
import { LeaveGuard, trackSave } from "@/components/leave-guard/LeaveGuard";
import { SavedNote } from "@/components/nudge/SavedNote";
import { pointTo } from "@/components/nudge/nudge";
import { localToday } from "@/lib/home-log/rules";
import { daysLabel } from "@/lib/tracker/rules";
import { templateSurahs } from "@/lib/students/new-student";
import { pickByPerson, type PersonGender } from "@/lib/text/gender";
import { genderText } from "@/lib/guide/help/text";
import { fillFamily } from "@/lib/guide/help/family/text";
import type { ChildSwitches } from "@/lib/guide/help/family/build";
import { CHILD_START_QUESTIONS } from "@/lib/guide/family-keys";
import {
  CHILD_START as T,
  MORE,
  MORE_FEATURES,
  START_FEATURES,
  currentPlanOption,
  moreFeaturesFor,
  planLabel,
  planOptionsFor,
  type ChildPlanChoice,
  type MoreFeature,
  type StartFeature,
} from "@/lib/guide/child-start-texts";
import { addPriorAction, savePlanAction } from "../../../../../actions";
import { setReviewRemindersAction } from "../../../../../settings/actions";
import { applyTemplateAction } from "../../../../../templates/actions";
import { copyTrackerAction } from "../../../../../tracker/family-actions";
import { setChildFeatureAction } from "../../../../actions";
import { markChildStartAction } from "../../../../guide-actions";
import s from "../../../../../start/start.module.css";

// The child's start questions (the family guide's review page ١ and ٢): one
// screen at a time; «التالي» is the only button that saves (and, in the
// remaining features, «تفعيل»: Mona, 2026-11-11), each answer at once,
// through the same actions as her pages. Nothing here removes or turns off
// anything she has. Where to resume is kept on her row (childStart.step),
// the end in childStart.done.

type Screen = "welcome" | "q1" | "q2" | "q3" | "q4" | "done" | "more" | "moreDone";
type BankCard = { id: string; title: string; description: string | null; suggested: boolean; items: { title: string; days: number }[] };
type Result = { error?: string } | null | undefined;

type Props = {
  you: PersonGender;
  child: { id: string; name: string; gender: PersonGender; code: string | null };
  base: string;
  done: boolean;
  step: number | null;
  planTemplate: string | null;
  plan: number[];
  priorSurahs: number;
  trackerItems: number;
  ownItems: number;
  siblings: { id: string; name: string; items: number }[];
  switches: ChildSwitches;
  familyCity: boolean;
  highlightReaches: boolean;
  bank: BankCard[];
};

const questionOf = (screen: Screen) => (screen[0] === "q" ? Number(screen[1]) : null);

const MORE_SWITCH: Record<MoreFeature, keyof ChildSwitches> = {
  goal: "goal",
  mutashabihat: "similar",
  tajweed: "tajweed",
  homeMistakes: "homeMistakes",
  summary: "summary",
  highlight: "highlight",
};

export function ChildStartWizard(props: Props) {
  const { you, child, base } = props;
  const router = useRouter();
  const who = { child: { name: child.name, gender: child.gender } };
  const t = (text: string) => genderText(fillFamily(text, who), you);

  const [screen, setScreen] = useState<Screen>(() => (props.done ? "done" : props.step ? (`q${Math.min(props.step, CHILD_START_QUESTIONS)}` as Screen) : "welcome"));
  const [history, setHistory] = useState<Screen[]>([]);
  const reached = useRef(props.step ?? 0);

  const current = currentPlanOption(props.planTemplate);
  const [planChoice, setPlanChoice] = useState<ChildPlanChoice | null>(current);
  const [planSaved, setPlanSaved] = useState<string | null>(props.planTemplate);
  const [custom, setCustom] = useState(false);
  const [hasPrior, setHasPrior] = useState<"yes" | "no" | null>(null);
  const prior = usePriorState();
  const [priorAdded, setPriorAdded] = useState(0);
  const [tracker, setTracker] = useState<"bank" | "copy" | "empty" | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [copyFrom, setCopyFrom] = useState<string | null>(null);
  const [items, setItems] = useState(props.trackerItems);
  const [ticks, setTicks] = useState<Record<StartFeature, boolean>>({ agenda: false, streak: false, homeLog: false, review: false });
  // switched on here (start features and remaining features), on top of her switches
  const [onNow, setOnNow] = useState<Partial<Record<keyof ChildSwitches, boolean>>>({});
  const sw = (k: keyof ChildSwitches) => props.switches[k] || onNow[k] === true;

  // the remaining features: fixed when they start, so the count doesn't move under her
  const [moreList, setMoreList] = useState<MoreFeature[]>([]);
  const [moreAt, setMoreAt] = useState(0);
  const [moreOn, setMoreOn] = useState<MoreFeature[]>([]);

  const [notice, setNotice] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const busy = useRef(false);

  const heading = useRef<HTMLHeadingElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const missingLine = useRef<HTMLParagraphElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [screen, moreAt]);

  const q = questionOf(screen);
  const copySources = [...(props.ownItems > 0 ? [{ id: "mine", name: T.q3.mine, items: props.ownItems }] : []), ...props.siblings];
  const remaining = () => moreFeaturesFor(Object.fromEntries(MORE_FEATURES.map((f) => [f.key, sw(MORE_SWITCH[f.key])])) as Record<MoreFeature, boolean>, sw("homeLog"), props.highlightReaches);

  function clearLines() {
    setMissing(null);
    setError(null);
  }

  function showMissing(text: string) {
    setMissing(text);
    setError(null);
    window.requestAnimationFrame(() => {
      if (missingLine.current) pointTo(missingLine.current, { focus: false });
      group.current?.querySelector<HTMLElement>("input, button, select")?.focus({ preventScroll: true });
    });
  }

  function remember(next: Screen) {
    const nq = questionOf(next);
    if (next === "done") void markChildStartAction(child.id, "childStart.done");
    else if (nq !== null && nq > reached.current) {
      reached.current = nq;
      void markChildStartAction(child.id, "childStart.step", { q: nq });
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
    if (next === "done") router.refresh();
  }

  function back() {
    if (screen === "more" && moreAt > 0) {
      setMoreAt((i) => i - 1);
      clearLines();
      setNotice(null);
      return;
    }
    const prev = history.length > 0 ? history[history.length - 1] : screen === "q1" ? "welcome" : (`q${(q ?? 2) - 1}` as Screen);
    setHistory((h) => h.slice(0, -1));
    setScreen(prev);
    clearLines();
    setNotice(null);
    setShowSaved(false);
  }

  async function run(...saves: (() => Promise<Result>)[]): Promise<boolean> {
    for (const save of saves) {
      const r = await trackSave(save()).catch(() => ({ error: T.saveError }));
      if (r?.error) {
        setError(r.error === T.saveError ? t(T.saveError) : r.error);
        return false;
      }
    }
    return true;
  }

  async function guarded(fn: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      await fn();
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const NEXT: Record<"welcome" | "q1" | "q2" | "q3" | "q4", Screen> = { welcome: "q1", q1: "q2", q2: "q3", q3: "q4", q4: "done" };

  async function next() {
    const today = localToday();
    switch (screen) {
      case "welcome":
        return advance("q1");
      case "q1": {
        if (!planChoice || planChoice === current) return advance("q2");
        if (planChoice === "custom") {
          setCustom(true);
          return advance("q2");
        }
        if (!(await run(() => savePlanAction({ template: planChoice, plan: templateSurahs(planChoice), today, subjectId: child.id })))) return;
        setPlanSaved(planOptionsFor(null).find((o) => o.key === planChoice)!.template);
        return advance("q2", null, true);
      }
      case "q2": {
        if (!hasPrior) return showMissing(t(T.q2.missing));
        if (hasPrior === "no") return advance("q3");
        const value = prior.value({ always: true, pendingRangeOf: props.plan });
        if (value.completedSurahs.length === 0 && !value.partial) return showMissing(t(T.q2.empty));
        if (!(await run(() => addPriorAction({ prior: value, today, subjectId: child.id })))) return;
        setPriorAdded((n) => n + value.completedSurahs.length + (value.partial ? 1 : 0));
        prior.reset();
        prior.setRangeFrom(null);
        prior.setRangeTo(null);
        return advance("q3", t(T.q2.saved), true);
      }
      case "q3": {
        if (!tracker) return showMissing(t(T.q3.missing));
        if (tracker === "empty") return advance("q4");
        if (tracker === "bank") {
          if (!template) return showMissing(t(T.q3.noBank));
          let added = 0;
          const ok = await run(async () => {
            const r = await applyTemplateAction(template, child.id);
            added = r.added ?? 0;
            return r;
          });
          if (!ok) return;
          setItems((n) => n + added);
          return advance("q4", t(T.q3.added(added)));
        }
        if (!copyFrom) return showMissing(t(T.q3.noCopy));
        let added = 0;
        const ok = await run(async () => {
          const r = await copyTrackerAction(copyFrom === "mine" ? null : copyFrom, [child.id]);
          added = r.report?.reduce((n, l) => n + l.added, 0) ?? 0;
          return r;
        });
        if (!ok) return;
        setItems((n) => n + added);
        return advance("q4", t(T.q3.copied(added)));
      }
      case "q4": {
        const want = START_FEATURES.map((f) => f.key).filter((k) => ticks[k] && !props.switches[k]);
        if (want.length === 0) return advance("done");
        const saves = want.map((k) => () => {
          if (k === "review") {
            const fd = new FormData();
            fd.set("subjectId", child.id);
            fd.set("on", "1");
            fd.set("days", "14");
            return setReviewRemindersAction(null, fd);
          }
          return setChildFeatureAction(child.id, k, true);
        });
        if (!(await run(...saves))) return;
        setOnNow((o) => ({ ...o, ...Object.fromEntries(want.map((k) => [k, true])) }));
        return advance("done", null, true);
      }
    }
  }

  function skip() {
    if (busy.current || q === null) return;
    const to = NEXT[screen as keyof typeof NEXT];
    advance(to, screen === "q1" && current ? t(T.q1.skipped(planLabel(props.planTemplate))) : null);
  }

  async function later() {
    await guarded(async () => {
      if (q !== null && q > reached.current) {
        reached.current = q;
        await markChildStartAction(child.id, "childStart.step", { q });
      }
      router.push(`${base}?later=1`);
    });
  }

  function startMore() {
    const list = remaining();
    setMoreList(list);
    setMoreAt(0);
    setMoreOn([]);
    setHistory((h) => [...h, screen]);
    setScreen(list.length ? "more" : "moreDone");
    clearLines();
    setNotice(null);
    setShowSaved(false);
  }

  function moreStep(line: string | null) {
    clearLines();
    setNotice(line);
    if (moreAt + 1 < moreList.length) setMoreAt((i) => i + 1);
    else {
      setHistory((h) => [...h, "more"]);
      setScreen("moreDone");
    }
  }

  async function enableMore() {
    const key = moreList[moreAt];
    const f = MORE_FEATURES.find((x) => x.key === key)!;
    await guarded(async () => {
      if (!(await run(() => setChildFeatureAction(child.id, key, true)))) return;
      setOnNow((o) => ({ ...o, [MORE_SWITCH[key]]: true }));
      setMoreOn((l) => [...l, key]);
      moreStep(MORE.enabled(f.title));
    });
  }

  // the end screen's summary, from what she has now
  const featureNames = START_FEATURES.filter((f) => sw(f.key)).map((f) => f.title);
  const summary = [
    T.done.plan(planLabel(planSaved)),
    ...(props.priorSurahs + priorAdded > 0 ? [T.done.prior(props.priorSurahs + priorAdded)] : []),
    ...(items > 0 ? [T.done.tracker(items)] : []),
    ...(featureNames.length ? [T.done.features(featureNames)] : []),
  ];
  const restLeft = screen === "done" ? remaining().length > 0 : true;
  const toPage = custom ? { href: `${base}/plan`, label: T.done.toPlan } : { href: base, label: T.done.toPage };

  const choices = <V extends string>(name: string, value: V | null, onChange: (v: V) => void, options: { value: V; label: string; desc?: string; meta?: string; chip?: string }[]) => (
    <div ref={group} role="radiogroup" aria-labelledby="start-title" className={s.opts}>
      {options.map((o) => (
        <label key={o.value} className={`${s.opt} ${value === o.value ? s.sel : ""}`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => (onChange(o.value), clearLines())} />
          <span>
            <b>
              {o.label}
              {o.chip && <span className={`${work.tag} ${work.green}`} style={{ marginInlineStart: 6 }}>{o.chip}</span>}
            </b>
            {o.desc && <small>{o.desc}</small>}
            {o.meta && <small>{o.meta}</small>}
          </span>
        </label>
      ))}
    </div>
  );

  const title = (text: string) => (
    <h1 id="start-title" ref={heading} tabIndex={-1} className={s.title}>
      {text}
    </h1>
  );

  const more = screen === "more" ? MORE_FEATURES.find((f) => f.key === moreList[moreAt]) : null;

  return (
    <div className={s.wrap}>
      <LeaveGuard you={you} />
      <div role="status" className={s.status}>
        {notice && <p className={hl.ok}>{notice}</p>}
        {saving && <span className={s.srOnly}>{T.saving}</span>}
      </div>
      <SavedNote stamp={showSaved ? savedCount : 0} className={s.saved} />
      <section key={screen === "more" ? `more-${moreAt}` : screen} className={`${hl.section} ${s.screen}`} aria-labelledby="start-title" aria-busy={saving || undefined}>
        {q !== null && <p className={s.progress}>{T.progress(q)}</p>}
        {more && <p className={s.progress}>{MORE.progress(moreAt + 1, moreList.length)}</p>}

        {screen === "welcome" && (
          <>
            {title(t(T.welcome.title))}
            <p className={s.text}>{t(T.welcome.body)}</p>
            <p className={s.text}>{t(T.welcome.skipHint)}</p>
          </>
        )}

        {screen === "q1" && (
          <>
            {title(t(T.q1.title))}
            {current && <p className={s.text}>{t(T.q1.intro(planLabel(props.planTemplate)))}</p>}
            {choices(
              "plan",
              planChoice,
              setPlanChoice,
              planOptionsFor(current).map((o) => ({ value: o.key, label: o.label, desc: t(o.desc), meta: o.meta, chip: o.key === current ? T.q1.current : undefined })),
            )}
            {planChoice === "custom" && planChoice !== current && <p className={s.note}>{t(T.q1.customNote)}</p>}
          </>
        )}

        {screen === "q2" && (
          <>
            {title(t(T.q2.title))}
            <p className={s.text}>{t(T.q2.intro)}</p>
            {choices("prior", hasPrior, setHasPrior, [
              { value: "yes", label: t(T.q2.yes) },
              { value: "no", label: t(T.q2.no) },
            ])}
            {hasPrior === "yes" && (
              <div className={s.sub}>
                <p className={s.text}>{t(T.q2.afterYes)}</p>
                <PriorPicker
                  plan={props.plan}
                  prior={prior}
                  alwaysOpen
                  words={{
                    none: "لا يوجد حفظ سابق",
                    yes: "نعم",
                    planOf: pickByPerson(child.gender, { m: "خطته", f: "خطتها" }),
                    choose: pickByPerson(you, { m: "اختر", f: "اختاري" }),
                    partialWho: pickByPerson(child.gender, { m: "يحفظ منها", f: "تحفظ منها" }),
                  }}
                />
              </div>
            )}
          </>
        )}

        {screen === "q3" && (
          <>
            {title(t(T.q3.title))}
            <p className={s.text}>{t(T.q3.intro)}</p>
            {items > 0 && <p className={s.note}>{t(T.q3.already(items))}</p>}
            {choices("tracker", tracker, setTracker, [
              ...(props.bank.length ? [{ value: "bank" as const, label: T.q3.bank, desc: t(T.q3.bankDesc) }] : []),
              ...(copySources.length ? [{ value: "copy" as const, label: T.q3.copy, desc: t(T.q3.copyDesc) }] : []),
              { value: "empty" as const, label: T.q3.empty, desc: t(T.q3.emptyDesc) },
            ])}
            <p className={s.note}>{t(T.q3.note)}</p>
            {tracker === "bank" && (
              <div className={s.cards}>
                {[...props.bank].sort((a, b) => Number(b.suggested) - Number(a.suggested)).map((c) => {
                  const chosen = template === c.id;
                  const open = openCard === c.id;
                  return (
                    <div key={c.id} className={`${s.card} ${chosen ? s.chosen : ""}`}>
                      <div className={s.cardHead}>
                        <b>{c.title}</b>
                        {c.suggested && <span className={`${work.tag} ${work.green}`}>{T.q3.suggested}</span>}
                      </div>
                      {c.description && <p className={s.cardDesc}>{c.description}</p>}
                      <div className={hl.actionsRow}>
                        <button type="button" className={hl.linkBtn} aria-expanded={open} onClick={() => setOpenCard(open ? null : c.id)}>
                          {open ? T.q3.hide : T.q3.show}
                        </button>
                        <button type="button" className={chosen ? hl.primaryBtn : hl.ghostBtn} aria-pressed={chosen} onClick={() => (setTemplate(c.id), clearLines())}>
                          {chosen ? T.q3.chosen : T.q3.choose}
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
            {tracker === "copy" && (
              <div className={s.sub}>
                <div className={s.opts} role="radiogroup" aria-label={T.q3.copy}>
                  {copySources.map((c) => (
                    <label key={c.id} className={`${s.opt} ${copyFrom === c.id ? s.sel : ""}`}>
                      <input type="radio" name="copyFrom" value={c.id} checked={copyFrom === c.id} onChange={() => (setCopyFrom(c.id), clearLines())} />
                      <span>
                        <b>{c.name}</b>
                        <small>{itemsLabel(c.items)}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <p className={s.note}>{T.q3.copyNote}</p>
              </div>
            )}
          </>
        )}

        {screen === "q4" && (
          <>
            {title(t(T.q4.title))}
            <p className={s.text}>{t(T.q4.intro)}</p>
            <div ref={group} className={s.opts}>
              {START_FEATURES.map((f) => {
                const already = props.switches[f.key];
                const checked = already || ticks[f.key];
                return (
                  <div key={f.key}>
                    <label className={`${s.opt} ${checked ? s.sel : ""}`}>
                      <input type="checkbox" checked={checked} disabled={already} onChange={(e) => setTicks((x) => ({ ...x, [f.key]: e.target.checked }))} />
                      <span>
                        <b>{f.title}</b>
                        <small>{t(f.desc)}</small>
                      </span>
                    </label>
                    {already && <p className={s.note}>{t(T.q4.alreadyOn)}</p>}
                    {f.key === "agenda" && !props.familyCity && <p className={s.note}>{T.q4.noCity}</p>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {screen === "done" && (
          <>
            {title(t(T.done.title))}
            <ul className={s.summary}>
              {summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {restLeft && <p className={s.text}>{t(T.done.others)}</p>}
            {child.code && (
              <p className={s.text}>
                {t(T.done.code(child.code))}{" "}
                <button
                  type="button"
                  className={hl.linkBtn}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(child.code ?? "");
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                >
                  {copied ? T.done.copied : T.done.copyCode}
                </button>
              </p>
            )}
          </>
        )}

        {more && (
          <>
            {title(more.title)}
            <p className={s.text}>{t(more.text)}</p>
          </>
        )}

        {screen === "moreDone" && (
          <>
            {title(t(MORE.doneTitle))}
            <p className={s.text}>{t(MORE.doneList(moreOn.map((k) => MORE_FEATURES.find((f) => f.key === k)!.title)))}</p>
            {moreOn.includes("goal") && <p className={s.text}>{t(MORE.goalNote)}</p>}
            <p className={s.text}>{t(MORE.change)}</p>
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
            <button type="button" className={hl.primaryBtn} onClick={() => guarded(next)}>
              {T.welcome.start}
            </button>
          )}
          {q !== null && (
            <>
              <button type="button" className={hl.primaryBtn} onClick={() => guarded(next)}>
                {saving ? T.saving : T.next}
              </button>
              <button type="button" className={hl.ghostBtn} onClick={back}>
                {T.back}
              </button>
              <button type="button" className={hl.ghostBtn} onClick={skip}>
                {T.skip}
              </button>
              <button type="button" className={hl.linkBtn} onClick={later}>
                {T.later}
              </button>
            </>
          )}
          {screen === "done" && (
            <>
              {restLeft && (
                <button type="button" className={hl.primaryBtn} onClick={startMore}>
                  {t(T.done.more)}
                </button>
              )}
              <Link href={toPage.href} className={restLeft ? hl.ghostBtn : hl.primaryBtn}>
                {t(toPage.label)}
              </Link>
            </>
          )}
          {more && (
            <>
              <button type="button" className={hl.primaryBtn} onClick={enableMore}>
                {saving ? T.saving : MORE.enable}
              </button>
              <button type="button" className={hl.ghostBtn} onClick={() => moreStep(null)}>
                {MORE.notNow}
              </button>
              <button type="button" className={hl.ghostBtn} onClick={back}>
                {MORE.back}
              </button>
              <Link href={base} className={hl.linkBtn}>
                {t(MORE.toPage)}
              </Link>
            </>
          )}
          {screen === "moreDone" && (
            <Link href={base} className={hl.primaryBtn}>
              {t(MORE.toPage)}
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

const itemsLabel = (n: number) => (n === 1 ? "بند واحد" : n === 2 ? "بندان" : n % 100 >= 3 && n % 100 <= 10 ? `${n} بنود` : `${n} بندًا`);
