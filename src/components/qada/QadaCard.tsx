"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import hl from "@/components/home-log/home-log.module.css";
import motion from "@/components/student-work/motion.module.css";
import css from "./qada.module.css";
import { dropLeaves, reducedMotion } from "@/components/student-work/DayCelebration";
import { pointTo } from "@/components/nudge/nudge";
import { trackSave } from "@/components/leave-guard/LeaveGuard";
import { useHelpAvoid } from "@/components/guide/help-avoid";
import { useGuideTarget } from "@/components/guide/targets";
import { addDays } from "@/lib/calendar/hijri";
import { KIND_NAMES, LIMITS, PRAYERS, type PrayerKind, type QadaKind, type QadaTrack } from "@/lib/qada/kinds";
import { estimate as runEstimate, parseEstimate, type EstimateInput, type EstimateResult } from "@/lib/qada/estimate";
import type { LogLine, QadaView } from "@/lib/qada/server";
import * as T from "@/lib/qada/texts";
import {
  ackQadaMilestoneAction,
  addFullDaysAction,
  addOwedAction,
  deleteAllQadaAction,
  deleteQadaLineAction,
  loadQadaAction,
  logMadeUpAction,
  saveEstimateAction,
  setQadaAverageAction,
  setQadaGoalAction,
} from "@/app/rafiq/(app)/qada-actions";

// «القضاء»: the card below the day in «جدول المتابعة» (her own, the child's own,
// and an adult's view of a child's). Not a tracker item: nothing here touches
// the day's score, «المحصّلات», the day's celebration or sharing. Its data
// comes from its own action with the browser's time zone (her days), cut on
// the server to what the one looking may see. «+1» shows at once and is
// saved in the background (put back with a message if saving fails), with
// «تراجع» for 10 seconds.

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const HIDE_KEY = "namaa:qada:hidden";
const OPEN_KEY = "namaa:qada:open";
/** Sent by «جدول المتابعة» after a tick on a linked item («يُحسب قضاءً»): the card reloads. */
export const QADA_CHANGED = "namaa:qada:changed";

type Panel = null | "add" | "log" | "goal" | "estimate" | "settings";
type Answer = { view: QadaView; id?: string } | { error: string };

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

/** «+1» or «+ عدد» (n) shown before the server answers: what it changes on the card. */
function plusMany(v: QadaView, kind: QadaKind, day: string, n: number): QadaView {
  const k = v.totals[kind];
  if (!k) return v;
  const next: QadaView = { ...v, totals: { ...v.totals, [kind]: { ...k, done: k.done + n, remaining: Math.max(0, k.remaining - n) } } };
  const t = kind === "FAST" ? "fast" : "prayers";
  const tt = v.totals[t];
  if (tt) {
    // what counts towards what she owes of this kind
    const counted = Math.max(0, Math.min(n, k.owed - k.done));
    next.totals[t] = { ...tt, done: tt.done + n, remaining: Math.max(0, tt.remaining - counted), pct: tt.owed ? Math.min(100, tt.pct + (counted * 100) / tt.owed) : 0 };
  }
  if (kind !== "FAST" && day === v.today && v.plan?.prayers.today) {
    const today = v.plan.prayers.today;
    next.plan = { ...v.plan, prayers: { ...v.plan.prayers, today: { ...today, done: { ...today.done, [kind]: today.done[kind as PrayerKind] + n } } } };
  }
  return next;
}

export function QadaCard({ subjectId }: { subjectId?: string }) {
  const [view, setView] = useState<QadaView | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  // the card renders only after its data has come (in the browser), so this device's choice is read at once
  const [hidden, setHidden] = useState(() => typeof window !== "undefined" && readHidden());
  // open, or folded to one line: per device, open by default
  const [opened, setOpened] = useState(() => typeof window === "undefined" || readOpen());
  const [earlier, setEarlier] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; key: number; undo: boolean } | null>(null);
  const [, start] = useTransition();
  const t = useGuideTarget();
  const undoRef = useRef<{ key: number; id: string | null; wanted: boolean; before: QadaView } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  // each toast's own number (a newer one replaces it)
  const toastSeq = useRef(0);
  useHelpAvoid(toast !== null, "lift");

  useEffect(() => {
    let alive = true;
    const load = (first: boolean) =>
      loadQadaAction({ subjectId, zone: zone() })
        .then((r) => {
          if (!alive) return;
          if ("error" in r) {
            if (first) setFailed(true);
          } else setView(r.view);
        })
        .catch(() => alive && first && setFailed(true));
    void load(true);
    // a tick on a linked item («يُحسب قضاءً») changed it: fresh numbers
    const again = () => void load(false);
    window.addEventListener(QADA_CHANGED, again);
    return () => {
      alive = false;
      window.removeEventListener(QADA_CHANGED, again);
    };
  }, [subjectId]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /** Sends a change; the answer is the card's fresh data. Returns it (or null with the message shown). */
  const send = useCallback(async (fn: () => Promise<Answer>): Promise<{ view: QadaView; id?: string } | null> => {
    setError(null);
    const r = await trackSave(fn()).catch(() => ({ error: T.ERR.fail }) as Answer);
    if ("error" in r) {
      setError(r.error);
      return null;
    }
    setView(r.view);
    return r;
  }, []);

  const showToast = (text: string, undo: { id: string | null; before: QadaView } | null) => {
    window.clearTimeout(toastTimer.current);
    const key = ++toastSeq.current;
    undoRef.current = undo ? { key, ...undo, wanted: false } : null;
    setToast({ text, key, undo: undo !== null });
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      undoRef.current = null;
    }, LIMITS.undoMs);
  };

  const undo = () => {
    const u = undoRef.current;
    if (!u) return;
    setView(u.before);
    window.clearTimeout(toastTimer.current);
    setToast({ text: T.UNDONE, key: ++toastSeq.current, undo: false });
    toastTimer.current = window.setTimeout(() => setToast(null), 2000);
    undoRef.current = null;
    if (u.id) start(async () => void (await send(() => deleteQadaLineAction({ subjectId, zone: zone(), id: u.id! }))));
    // the «+1» hasn't been answered yet: undone as soon as it is
    else u.wanted = true;
    pending.current = u.wanted ? u : null;
  };
  // a «+1» still on its way whose «تراجع» was pressed
  const pending = useRef<{ wanted: boolean; key: number } | null>(null);

  /** «+1» (n = 1: today, or the day of «في يوم سابق») or «+ عدد»: shown at once, saved as one entry, undone as one. */
  const logMade = (kind: QadaKind, day: string, n: number) => {
    if (!view) return;
    const before = view;
    setView(plusMany(view, kind, day, n));
    showToast(n === 1 ? T.loggedToast(kind, day, view.today) : T.loggedManyToast(kind, n, day, view.today), { id: null, before });
    const key = undoRef.current?.key;
    start(async () => {
      const r = await trackSave(logMadeUpAction({ subjectId, zone: zone(), kind, day, count: n })).catch(() => ({ error: T.ERR.fail }) as Answer);
      if ("error" in r) {
        setView(before);
        setError(r.error);
        if (undoRef.current?.key === key) {
          setToast(null);
          undoRef.current = null;
        }
        return;
      }
      if (pending.current && pending.current.key === key) {
        pending.current = null;
        await send(() => deleteQadaLineAction({ subjectId, zone: zone(), id: r.id! }));
        return;
      }
      setView(r.view);
      const u = undoRef.current;
      if (u && u.key === key) u.id = r.id ?? null;
    });
  };

  const toggleOpen = () => {
    const next = !opened;
    setOpened(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      // no storage: this visit only
    }
  };

  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(HIDE_KEY, next ? "1" : "0");
    } catch {
      // no storage: this visit only
    }
  };

  if (failed) return null;
  if (!view) return <div className={`${hl.section} ${css.placeholder}`} aria-busy="true" />;

  const mask = (s: string) => (hidden ? s.replace(/\d+/g, T.HIDDEN_NUMBER) : s);
  const a = view.access;
  const you = view.you;
  const who = view.who;
  const empty = view.totals.prayers.owed + view.totals.prayers.done + (view.totals.fast ? view.totals.fast.owed + view.totals.fast.done : 0) === 0;
  const hasFast = !!view.totals.fast && view.totals.fast.owed + view.totals.fast.done > 0;
  const hasPrayers = view.totals.prayers.owed + view.totals.prayers.done > 0;
  const open = (p: Panel) => setPanel(panel === p ? null : p);
  const settings = (a.plan && a.excuseAware) || a.deleteAll;

  return (
    <section className={`${hl.section} ${css.card}`} aria-label={T.cardTitle(who)} {...t("tracker.qada")}>
      <div className={css.head}>
        <button type="button" className={css.fold} aria-expanded={opened} aria-controls="qada-body" title={T.collapseLabel(opened)} onClick={toggleOpen}>
          <span className={css.title}>
            {opened
              ? T.cardTitle(who)
              : mask(
                  T.collapsedLine(
                    who,
                    view.totals.prayers.owed > 0 ? view.totals.prayers.remaining : null,
                    view.totals.fast && view.totals.fast.owed > 0 ? view.totals.fast.remaining : null,
                  ),
                )}
          </span>
          <span className={css.chev} aria-hidden="true">
            ▾
          </span>
          <span className={css.srOnly}>{T.collapseLabel(opened)}</span>
        </button>
        {!empty && (
          <button type="button" className={`${css.eye} pressable`} aria-pressed={hidden} aria-label={T.hideLabel(hidden)} title={T.hideLabel(hidden)} onClick={toggleHidden}>
            {hidden ? "🙈" : "👁"}
          </button>
        )}
      </div>

      {a.milestones && <Milestones view={view} subjectId={subjectId} onView={setView} />}

      <div id="qada-body" className={`${css.body} ${opened ? css.bodyOpen : ""}`} inert={!opened}>
        <div className={css.bodyInner}>
      {empty ? (
        <p className={css.soft}>{T.emptyText(you, who)}</p>
      ) : (
        <>
          {hasPrayers && (
            <div className={css.block}>
              <TrackHead track="prayers" view={view} mask={mask} hidden={hidden} />
              <PrayerPlanLines view={view} mask={mask} onExtend={() => setPanel("goal")} />
              <div className={css.rows}>
                {PRAYERS.map((k) => (
                  <KindRow key={k} kind={k} view={view} mask={mask} onPlus={() => logMade(k, earlier ?? view.today, 1)} onMany={(n, d) => logMade(k, d, n)} canEdit={a.edit} />
                ))}
              </div>
            </div>
          )}
          {hasFast && (
            <div className={css.block}>
              <TrackHead track="fast" view={view} mask={mask} hidden={hidden} />
              <FastPlanLines view={view} mask={mask} onExtend={() => setPanel("goal")} />
              <div className={css.rows}>
                <KindRow kind="FAST" view={view} mask={mask} onPlus={() => logMade("FAST", earlier ?? view.today, 1)} onMany={(n, d) => logMade("FAST", d, n)} canEdit={a.edit} />
              </div>
            </div>
          )}
          {a.edit && <Earlier today={view.today} you={you} value={earlier} onChange={setEarlier} />}
        </>
      )}

      {error && (
        <div className={hl.err} role="alert" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}

      <div className={css.buttons}>
        {a.edit && (
          <button type="button" className={`${hl.ghostBtn} pressable`} aria-expanded={panel === "add"} onClick={() => open("add")}>
            {T.BUTTONS.add}
          </button>
        )}
        {a.plan && (
          <button type="button" className={`${hl.ghostBtn} pressable`} aria-expanded={panel === "estimate"} onClick={() => open("estimate")}>
            {T.BUTTONS.estimate}
          </button>
        )}
        {!empty && a.plan && (
          <button type="button" className={`${hl.ghostBtn} pressable`} aria-expanded={panel === "goal"} onClick={() => open("goal")}>
            {T.BUTTONS.goal}
          </button>
        )}
        {!empty && (
          <button type="button" className={`${hl.ghostBtn} pressable`} aria-expanded={panel === "log"} onClick={() => open("log")}>
            {T.BUTTONS.log}
          </button>
        )}
        {settings && (
          <button type="button" className={`${hl.ghostBtn} pressable`} aria-expanded={panel === "settings"} onClick={() => open("settings")}>
            {T.BUTTONS.settings}
          </button>
        )}
      </div>

      {panel === "add" && <AddPanel view={view} send={send} subjectId={subjectId} onClose={() => setPanel(null)} />}
      {panel === "log" && <LogPanel view={view} send={send} subjectId={subjectId} mask={mask} onClose={() => setPanel(null)} />}
      {panel === "goal" && view.plan && <GoalPanel view={view} send={send} subjectId={subjectId} onClose={() => setPanel(null)} />}
      {panel === "estimate" && view.plan && <EstimatePanel view={view} send={send} subjectId={subjectId} onClose={() => setPanel(null)} />}
      {panel === "settings" && <SettingsPanel view={view} send={send} subjectId={subjectId} onClose={() => setPanel(null)} />}
        </div>
      </div>

      {toast &&
        typeof document !== "undefined" &&
        createPortal(
          <div className={css.toast} role="status" dir="rtl" key={toast.key}>
            <span className={css.toastText}>{toast.text}</span>
            {toast.undo && (
              <button type="button" className={css.toastUndo} onClick={undo}>
                {T.UNDO}
              </button>
            )}
          </div>,
          document.body,
        )}
    </section>
  );
}

// ---------- parts of the card ----------

function TrackHead({ track, view, mask, hidden }: { track: QadaTrack; view: QadaView; mask: (s: string) => string; hidden: boolean }) {
  const tt = view.totals[track]!;
  return (
    <>
      <div className={css.trackHead}>
        <span className={css.trackName}>{T.TRACK_TITLE[track]}</span>
        {tt.owed > 0 && !hidden ? (
          <div className={hl.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(tt.pct)} aria-label={T.TRACK_TITLE[track]}>
            <div className={`${hl.fill} ${tt.pct >= 100 ? hl.full : ""}`} style={{ width: `${tt.pct}%` }} />
          </div>
        ) : (
          <span />
        )}
        {tt.owed > 0 && <span className={css.trackPct}>{mask(T.pctLabel(tt.pct))}</span>}
      </div>
      <div className={css.trackLine}>{mask(T.trackLine(track, tt.remaining, tt.done))}</div>
    </>
  );
}

function KindRow({
  kind,
  view,
  mask,
  onPlus,
  onMany,
  canEdit,
}: {
  kind: QadaKind;
  view: QadaView;
  mask: (s: string) => string;
  onPlus: () => void;
  onMany: (n: number, day: string) => void;
  canEdit: boolean;
}) {
  const [many, setMany] = useState(false);
  const k = view.totals[kind];
  if (!k) return null;
  return (
    <>
      <div className={css.row}>
        <span className={css.kind}>{KIND_NAMES[kind]}</span>
        <span className={css.left}>{mask(k.owed > 0 ? T.remainingLabel(kind, k.remaining) : k.done > 0 ? `قُضي ${k.done}` : "—")}</span>
        {canEdit && (
          <span className={css.plusPair}>
            <button type="button" className={`${css.many} pressable`} aria-expanded={many} aria-label={T.plusManyLabel(kind)} onClick={() => setMany(!many)}>
              {T.PLUS_MANY}
            </button>
            <button type="button" className={`${css.plus} pressable`} aria-label={T.plusOneLabel(kind)} onClick={onPlus}>
              {T.PLUS_ONE}
            </button>
          </span>
        )}
      </div>
      {canEdit && many && (
        <ManyRow
          kind={kind}
          today={view.today}
          onSave={(n, day) => {
            setMany(false);
            onMany(n, day);
          }}
        />
      )}
    </>
  );
}

/** «+ عدد»: how many and which day (today, or up to 7 days back) → one entry, one «تراجع». */
function ManyRow({ kind, today, onSave }: { kind: QadaKind; today: string; onSave: (n: number, day: string) => void }) {
  const [count, setCount] = useState("");
  const [day, setDay] = useState(today);
  const [err, setErr] = useState(false);
  const countRef = useRef<HTMLInputElement>(null);
  const id = `qada-many-${kind}`;
  const save = () => {
    const n = intOf(count);
    if (!(n >= 1 && n <= LIMITS.maxMadeUp)) {
      setErr(true);
      return pointTo(countRef.current);
    }
    onSave(n, day);
  };
  return (
    <div className={css.manyRow}>
      <div className={css.field}>
        <label htmlFor={`${id}-n`}>{T.MANY_COUNT}</label>
        <input
          id={`${id}-n`}
          ref={countRef}
          className={`${css.input} ${css.narrow}`}
          inputMode="numeric"
          autoFocus
          value={count}
          onChange={(e) => {
            setCount(e.target.value);
            setErr(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
      </div>
      <div className={css.field}>
        <label htmlFor={`${id}-d`}>{T.MANY_DAY}</label>
        <select id={`${id}-d`} className={css.input} value={day} onChange={(e) => setDay(e.target.value)}>
          {Array.from({ length: LIMITS.backDays + 1 }, (_, i) => addDays(today, -i)).map((d) => (
            <option key={d} value={d}>
              {T.manyDayLabel(d, today)}
            </option>
          ))}
        </select>
      </div>
      <div className={css.field}>
        <button type="button" className={`${hl.primaryBtn} pressable`} onClick={save}>
          {T.MANY_SUBMIT}
        </button>
      </div>
      {err && (
        <div className={hl.err} style={{ flexBasis: "100%" }}>
          {T.ERR.madeUpCount}
        </div>
      )}
    </div>
  );
}

function PrayerPlanLines({ view, mask, onExtend }: { view: QadaView; mask: (s: string) => string; onExtend: () => void }) {
  const p = view.plan?.prayers;
  if (!p || p.mode === "NONE") return null;
  const today = p.today;
  const allDone = today && PRAYERS.every((k) => today.done[k] >= today.per[k]);
  return (
    <>
      {today &&
        (allDone ? (
          <p className={css.good}>{T.todayDone(view.you, view.who)}</p>
        ) : (
          <p className={css.planLine}>
            <b>{T.TODAY}</b>{" "}
            {mask(
              PRAYERS.filter((k) => today.per[k] > 0)
                .map((k) => T.todayPart(k, today.done[k], today.per[k]))
                .join(" · "),
            )}
          </p>
        ))}
      {p.standing === "ahead" && <p className={css.good}>{T.ahead(view.you, view.who)}</p>}
      {p.standing === "extend" && <Extend you={view.you} onExtend={onExtend} />}
      {p.mode === "DEADLINE" && p.deadline && <p className={css.soft}>{mask(T.deadlineLine(p.deadline))}</p>}
      {p.mode === "PACE" && p.pace && (
        <p className={css.soft}>
          {mask(T.paceLine("prayers", p.pace))}
          {p.finish && <> · {mask(T.finishLine(p.finish))}</>}
        </p>
      )}
    </>
  );
}

function FastPlanLines({ view, mask, onExtend }: { view: QadaView; mask: (s: string) => string; onExtend: () => void }) {
  const f = view.plan?.fast;
  if (!f || f.mode === "NONE") return null;
  return (
    <>
      {f.mode === "DEADLINE" && f.perWeek !== null && <p className={css.planLine}>{mask(T.perWeekLabel(f.perWeek))}</p>}
      {f.standing === "ahead" && <p className={css.good}>{T.ahead(view.you, view.who)}</p>}
      {f.standing === "extend" && <Extend you={view.you} onExtend={onExtend} />}
      {f.mode === "DEADLINE" && f.deadline && <p className={css.soft}>{mask(T.deadlineLine(f.deadline))}</p>}
      {f.mode === "PACE" && f.pace && (
        <p className={css.soft}>
          {mask(T.paceLine("fast", f.pace))}
          {f.finish && <> · {mask(T.finishLine(f.finish))}</>}
        </p>
      )}
      {f.suggestions.length > 0 && (
        <>
          <p className={css.soft} style={{ marginTop: 8 }}>
            {T.SUGGESTED}
          </p>
          <div className={css.chips}>
            {f.suggestions.map((s) => (
              <span key={s.day} className={css.chip}>
                {mask(T.dayLabel(s.day, view.today))}
                {s.reasons.includes("WHITE") && ` · ${T.REASONS.WHITE}`}
              </span>
            ))}
          </div>
          <p className={css.soft}>{T.suggestionNote(view.you)}</p>
        </>
      )}
    </>
  );
}

function Extend({ you, onExtend }: { you: "MALE" | "FEMALE"; onExtend: () => void }) {
  return (
    <p className={css.soft} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {T.extendQuestion(you)}
      <button type="button" className={hl.linkBtn} onClick={onExtend}>
        {T.EXTEND}
      </button>
    </p>
  );
}

/** «في يوم سابق»: the day the next «+1» goes to (up to 7 days back); today by default. */
function Earlier({ today, you, value, onChange }: { today: string; you: "MALE" | "FEMALE"; value: string | null; onChange: (d: string | null) => void }) {
  const [on, setOn] = useState(value !== null);
  return (
    <div className={css.earlier}>
      <label className={css.check}>
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            onChange(e.target.checked ? addDays(today, -1) : null);
          }}
        />
        {T.EARLIER_DAY}
      </label>
      {on && (
        <>
          <select className={`${css.input} ${css.narrow}`} style={{ maxWidth: 200 }} value={value ?? addDays(today, -1)} onChange={(e) => onChange(e.target.value)} aria-label={T.EARLIER_DAY}>
            {Array.from({ length: LIMITS.backDays }, (_, i) => addDays(today, -(i + 1))).map((d) => (
              <option key={d} value={d}>
                {T.dayLabel(d, today)}
              </option>
            ))}
          </select>
          <span className={css.soft} style={{ margin: 0 }}>
            {T.EARLIER_HINT(you)}
          </span>
        </>
      )}
    </div>
  );
}

/** The owner's milestone lines (25/50/75) and the celebration at 100%, each once. */
function Milestones({ view, subjectId, onView }: { view: QadaView; subjectId?: string; onView: (v: QadaView) => void }) {
  const list = view.milestones;
  const [lines, setLines] = useState<{ track: QadaTrack; level: 25 | 50 | 75 }[]>([]);
  const [party, setParty] = useState<QadaTrack | null>(null);
  const [phase, setPhase] = useState<"off" | "in" | "shown">("off");
  const stage = useRef<HTMLDivElement>(null);
  useHelpAvoid(phase !== "off", "hide");
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const m of list ?? []) {
      const key = `${m.track}:${m.level}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      // shown on the next frame (mounted first, so the entrance transitions)
      requestAnimationFrame(() => {
        if (m.level === 100) {
          setParty(m.track);
          setPhase("in");
          if (stage.current && !reducedMotion()) dropLeaves(stage.current);
          requestAnimationFrame(() => setPhase("shown"));
          window.setTimeout(() => setPhase("off"), 4000);
        } else setLines((l) => [...l.filter((x) => x.track !== m.track), { track: m.track, level: m.level as 25 | 50 | 75 }]);
      });
      // shown once: kept on the server straight away
      void ackQadaMilestoneAction({ subjectId, zone: zone(), track: m.track, level: m.level }).then((r) => {
        if (!("error" in r)) onView({ ...r.view, milestones: undefined });
      });
    }
  }, [list, subjectId, onView]);
  return (
    <>
      <div ref={stage} className={motion.stage} aria-hidden={phase === "off"}>
        {phase !== "off" && party && (
          <div className={`${motion.message} ${phase === "shown" ? motion.shown : ""}`} role="status" onClick={() => setPhase("off")}>
            <div className={motion.messageTitle}>{T.celebrationTitle(view.you)}</div>
            <div className={motion.messageLine}>{T.celebrationLine(party, view.you)}</div>
          </div>
        )}
      </div>
      {lines.map((m) => (
        <div key={m.track} className={css.milestone} role="status">
          <span>{T.milestoneLine(m.level, m.track, view.you)}</span>
          <button type="button" className={css.x} aria-label={T.BUTTONS.close} onClick={() => setLines((l) => l.filter((x) => x.track !== m.track))}>
            ×
          </button>
        </div>
      ))}
    </>
  );
}

// ---------- panels ----------

type PanelProps = {
  view: QadaView;
  subjectId?: string;
  send: (fn: () => Promise<Answer>) => Promise<{ view: QadaView; id?: string } | null>;
  onClose: () => void;
};

function PanelHead({ title, onClose, danger = false }: { title: string; onClose: () => void; danger?: boolean }) {
  return (
    <div className={`${css.panelTitle} ${danger ? css.dangerTitle : ""}`}>
      <span>{title}</span>
      <button type="button" className={css.x} aria-label={T.BUTTONS.close} onClick={onClose}>
        ×
      </button>
    </div>
  );
}

const intOf = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

/** «+ إضافة قضاء» and «يوم كامل». */
function AddPanel({ view, subjectId, send, onClose }: PanelProps) {
  const [kind, setKind] = useState<QadaKind>("FAJR");
  const [count, setCount] = useState("");
  const [day, setDay] = useState("");
  const [days, setDays] = useState("");
  const [msg, setMsg] = useState<{ at: "one" | "full"; text: string; ok?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const countRef = useRef<HTMLInputElement>(null);
  const daysRef = useRef<HTMLInputElement>(null);
  const addOne = () => {
    if (pending) return;
    const n = intOf(count);
    if (!(n >= 1 && n <= LIMITS.maxCount)) {
      setMsg({ at: "one", text: T.ERR.count });
      return pointTo(countRef.current);
    }
    start(async () => {
      const r = await send(() => addOwedAction({ subjectId, zone: zone(), kind, count: n, day: day || null }));
      if (r) {
        setCount("");
        setDay("");
        setMsg({ at: "one", text: T.added, ok: true });
      }
    });
  };
  const addFull = () => {
    if (pending) return;
    const n = intOf(days);
    if (!(n >= 1 && n <= LIMITS.maxFullDays)) {
      setMsg({ at: "full", text: T.ERR.count });
      return pointTo(daysRef.current);
    }
    start(async () => {
      const r = await send(() => addFullDaysAction({ subjectId, zone: zone(), days: n }));
      if (r) {
        setDays("");
        setMsg({ at: "full", text: T.added, ok: true });
      }
    });
  };
  return (
    <div className={css.panel}>
      <PanelHead title={T.ADD_TITLE} onClose={onClose} />
      <div className={css.inline}>
        <div className={css.field}>
          <label htmlFor="qada-kind">{T.ADD_KIND}</label>
          <select id="qada-kind" className={css.input} value={kind} onChange={(e) => setKind(e.target.value as QadaKind)}>
            {view.kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_NAMES[k]}
              </option>
            ))}
          </select>
        </div>
        <div className={css.field}>
          <label htmlFor="qada-count">{T.ADD_COUNT}</label>
          <input id="qada-count" ref={countRef} className={`${css.input} ${css.narrow}`} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
        </div>
        <div className={css.field}>
          <label htmlFor="qada-date">{T.ADD_DATE}</label>
          <input id="qada-date" type="date" className={css.input} max={view.today} value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
      </div>
      {msg?.at === "one" && <div className={msg.ok ? hl.ok : hl.err}>{msg.text}</div>}
      <div className={hl.actionsRow} style={{ marginTop: 0 }}>
        <button type="button" className={`${hl.primaryBtn} pressable`} onClick={addOne} aria-busy={pending}>
          {T.ADD_SUBMIT}
        </button>
      </div>

      <div className={css.block}>
        <div className={css.label}>{T.FULL_DAY_TITLE}</div>
        <p className={css.soft}>{T.FULL_DAY_NOTE}</p>
        <div className={css.inline} style={{ marginTop: 6 }}>
          <div className={css.field}>
            <label htmlFor="qada-days">{T.FULL_DAY_COUNT}</label>
            <input id="qada-days" ref={daysRef} className={`${css.input} ${css.narrow}`} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div className={css.field}>
            <button type="button" className={`${hl.primaryBtn} pressable`} onClick={addFull} aria-busy={pending}>
              {T.ADD_SUBMIT}
            </button>
          </div>
        </div>
        {msg?.at === "full" && <div className={msg.ok ? hl.ok : hl.err}>{msg.text}</div>}
      </div>
    </div>
  );
}

function lineText(l: LogLine): string {
  const label = l.source === "ESTIMATE" ? T.LOG_KIND.ESTIMATE : l.source === "FULL_DAY" ? T.LOG_KIND.FULL_DAY : T.LOG_KIND[l.action];
  const body = l.source === "FULL_DAY" && l.parts.length ? T.fullDayParts(l.parts[0].count) : T.logParts(l.parts);
  // a tick on a linked item: «من بند «…» في الجدول»
  return `${label}: ${body}${l.source === "TRACKER" ? ` — ${T.logFromItem(l.fromItem ?? null)}` : ""}`;
}

/** «السجل»: every line, newest first; a line is deleted after «نعم، حذف». */
function LogPanel({ view, subjectId, send, onClose, mask }: PanelProps & { mask: (s: string) => string }) {
  const [asking, setAsking] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className={css.panel}>
      <PanelHead title={T.LOG_TITLE} onClose={onClose} />
      {!view.access.dates && <p className={css.soft}>{T.LOG_NOTE_NO_DATES}</p>}
      {view.log.length === 0 ? (
        <p className={css.soft}>{T.LOG_EMPTY}</p>
      ) : (
        <ul className={css.log}>
          {view.log.map((l) => (
            <li key={l.id} className={css.logLine}>
              <div>
                <div>{mask(lineText(l))}</div>
                <div className={css.logMeta}>
                  {[l.day ? mask(T.logForDay(l.day, view.today)) : null, l.createdAt ? mask(T.logAddedAt(l.createdAt)) : null, l.by !== undefined ? T.logBy(l.by) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              {view.access.edit && (
                <button type="button" className={css.trash} aria-label={T.DELETE_LINE} onClick={() => setAsking(asking === l.id ? null : l.id)}>
                  🗑
                </button>
              )}
              {asking === l.id && (
                <div className={css.confirm}>
                  <span>{T.deleteLineQuestion}</span>
                  <button
                    type="button"
                    className={`${css.danger} pressable`}
                    aria-busy={pending}
                    onClick={() =>
                      start(async () => {
                        if (await send(() => deleteQadaLineAction({ subjectId, zone: zone(), id: l.id }))) setAsking(null);
                      })
                    }
                  >
                    {T.DELETE_YES}
                  </button>
                  <button type="button" className={hl.ghostBtn} onClick={() => setAsking(null)}>
                    {T.BUTTONS.cancel}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** «الهدف»: for the prayers and for fasting, one mode each. */
function GoalPanel({ view, subjectId, send, onClose }: PanelProps) {
  return (
    <div className={css.panel}>
      <PanelHead title={T.BUTTONS.goal} onClose={onClose} />
      {view.access.excuseAware && <p className={css.soft}>{T.GOAL_EXCUSE_NOTE}</p>}
      <GoalForm track="prayers" view={view} subjectId={subjectId} send={send} />
      {view.plan?.goals.fast && <GoalForm track="fast" view={view} subjectId={subjectId} send={send} />}
    </div>
  );
}

function GoalForm({ track, view, subjectId, send }: { track: QadaTrack; view: QadaView; subjectId?: string; send: PanelProps["send"] }) {
  const goal = (track === "prayers" ? view.plan!.goals.prayers : view.plan!.goals.fast)!;
  const [mode, setMode] = useState(goal.mode);
  const [deadline, setDeadline] = useState(goal.deadline ?? "");
  const [pace, setPace] = useState(goal.pace ? String(goal.pace) : "");
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const fieldRef = useRef<HTMLInputElement>(null);
  const hint = T.goalModeHint(track, view.you)[mode];
  const save = () => {
    if (pending) return;
    if (mode === "DEADLINE" && !(deadline > view.today)) {
      setMsg({ text: T.ERR.deadline });
      return pointTo(fieldRef.current);
    }
    const n = intOf(pace);
    const max = track === "fast" ? LIMITS.maxFastPace : LIMITS.maxPrayerPace;
    if (mode === "PACE" && !(n >= 1 && n <= max)) {
      setMsg({ text: T.ERR.pace });
      return pointTo(fieldRef.current);
    }
    start(async () => {
      const r = await send(() =>
        setQadaGoalAction({ subjectId, zone: zone(), track, mode, ...(mode === "DEADLINE" ? { deadline } : {}), ...(mode === "PACE" ? { pace: n } : {}) }),
      );
      if (r) setMsg({ text: T.goalSaved, ok: true });
    });
  };
  return (
    <div className={css.block}>
      <div className={css.label}>{T.GOAL_TITLE[track]}</div>
      <div className={css.modes} role="group" aria-label={T.GOAL_TITLE[track]}>
        {(["DEADLINE", "PACE", "NONE"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`${css.mode} pressable`}
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setMsg(null);
            }}
          >
            {T.GOAL_MODES[m]}
          </button>
        ))}
      </div>
      <p className={css.soft}>{hint}</p>
      {mode === "DEADLINE" && (
        <div className={css.field}>
          <label htmlFor={`qada-deadline-${track}`}>{T.GOAL_DEADLINE}</label>
          <input id={`qada-deadline-${track}`} ref={fieldRef} type="date" className={css.input} min={addDays(view.today, 1)} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
      )}
      {mode === "PACE" && (
        <div className={css.field}>
          <label htmlFor={`qada-pace-${track}`}>{T.GOAL_PACE[track]}</label>
          <input id={`qada-pace-${track}`} ref={fieldRef} className={`${css.input} ${css.narrow}`} inputMode="numeric" value={pace} onChange={(e) => setPace(e.target.value)} />
        </div>
      )}
      {track === "fast" && mode !== "NONE" && <p className={css.soft}>{T.GOAL_FAST_NOTE}</p>}
      {msg && <div className={msg.ok ? hl.ok : hl.err}>{msg.text}</div>}
      <div className={hl.actionsRow}>
        <button type="button" className={`${hl.primaryBtn} pressable`} onClick={save} aria-busy={pending}>
          {T.GOAL_SAVE}
        </button>
      </div>
    </div>
  );
}

const DEFAULT_ANSWERS = (woman: boolean): EstimateInput => ({
  prayers: [...PRAYERS],
  years: 0,
  months: 0,
  excludeRamadan: true,
  excuseDays: woman ? 7 : null,
  ramadans: 0,
  fastDays: 0,
});

/** «حساب تقديري»: her answers → an editable preview → saved as one line, in place of the previous estimate. */
function EstimatePanel({ view, subjectId, send, onClose }: PanelProps) {
  const woman = view.access.excuseAware;
  const saved = view.plan?.estimate;
  const [a, setA] = useState<EstimateInput>(() => saved ?? { ...DEFAULT_ANSWERS(woman), excuseDays: woman ? (view.plan?.avg ?? 7) : null });
  const [raw, setRaw] = useState(() => ({
    years: String(a.years),
    months: String(a.months),
    excuseDays: a.excuseDays === null ? "" : String(a.excuseDays),
    ramadans: String(a.ramadans),
    fastDays: String(a.fastDays),
  }));
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLDivElement>(null);
  const togglePrayer = (p: PrayerKind) => setA((x) => ({ ...x, prayers: x.prayers.includes(p) ? x.prayers.filter((y) => y !== p) : PRAYERS.filter((y) => y === p || x.prayers.includes(y)) }));
  const all = a.prayers.length === PRAYERS.length;

  const calc = () => {
    const answers = parseEstimate({ ...a, ...raw }, woman);
    if (!answers) {
      setMsg({ text: T.ERR.estimate });
      return pointTo(formRef.current, { focus: false });
    }
    setMsg(null);
    const r: EstimateResult = runEstimate(answers);
    setA(answers);
    setPreview({ ...Object.fromEntries(PRAYERS.map((p) => [p, String(r.prayers[p] ?? 0)])), FAST: String(view.access.fasting ? r.fast : 0) });
  };
  const save = () => {
    if (pending) return;
    if (!preview) return;
    const nums = Object.fromEntries(Object.entries(preview).map(([k, v]) => [k, intOf(v)]));
    if (Object.values(nums).some((n) => !(n >= 0 && n <= LIMITS.maxCount))) {
      setMsg({ text: T.ERR.count });
      return pointTo(formRef.current, { focus: false });
    }
    const prev = { prayers: Object.fromEntries(PRAYERS.map((p) => [p, nums[p]])), fast: nums.FAST };
    start(async () => {
      const r = await send(() => saveEstimateAction({ subjectId, zone: zone(), answers: a, preview: prev }));
      if (r) {
        setMsg({ text: T.estimateSaved, ok: true });
        setPreview(null);
      }
    });
  };

  return (
    <div className={css.panel} ref={formRef}>
      <PanelHead title={T.ESTIMATE_TITLE} onClose={onClose} />
      <p className={css.soft}>{T.estimateNote(view.you)}</p>
      {!preview ? (
        <>
          <div className={css.block}>
            <div className={css.label}>{T.EST_PRAYERS}</div>
            <div className={css.chips}>
              <label className={css.check}>
                <input type="checkbox" checked={all} onChange={() => setA((x) => ({ ...x, prayers: all ? [] : [...PRAYERS] }))} />
                {T.EST_ALL}
              </label>
              {PRAYERS.map((p) => (
                <label key={p} className={css.check}>
                  <input type="checkbox" checked={a.prayers.includes(p)} onChange={() => togglePrayer(p)} />
                  {KIND_NAMES[p]}
                </label>
              ))}
            </div>
            <div className={css.label} style={{ marginTop: 8 }}>
              {T.EST_DURATION}
            </div>
            <div className={css.inline}>
              <div className={css.field}>
                <label htmlFor="qada-years">{T.EST_YEARS}</label>
                <input id="qada-years" className={`${css.input} ${css.narrow}`} inputMode="numeric" value={raw.years} onChange={(e) => setRaw({ ...raw, years: e.target.value })} />
              </div>
              <div className={css.field}>
                <label htmlFor="qada-months">{T.EST_MONTHS}</label>
                <input id="qada-months" className={`${css.input} ${css.narrow}`} inputMode="numeric" value={raw.months} onChange={(e) => setRaw({ ...raw, months: e.target.value })} />
              </div>
            </div>
            <label className={css.check}>
              <input type="checkbox" checked={a.excludeRamadan} onChange={(e) => setA({ ...a, excludeRamadan: e.target.checked })} />
              {T.EST_EXCLUDE_RAMADAN}
            </label>
            {woman && (
              <div className={css.field}>
                <label htmlFor="qada-excuse">{T.EST_EXCUSE}</label>
                <input id="qada-excuse" className={`${css.input} ${css.narrow}`} inputMode="numeric" value={raw.excuseDays} onChange={(e) => setRaw({ ...raw, excuseDays: e.target.value })} />
              </div>
            )}
          </div>
          {view.access.fasting && (
            <div className={css.block}>
              <div className={css.label}>{T.EST_FAST}</div>
              {woman ? (
                <div className={css.field}>
                  <label htmlFor="qada-ramadans">{T.EST_RAMADANS}</label>
                  <input id="qada-ramadans" className={`${css.input} ${css.narrow}`} inputMode="numeric" value={raw.ramadans} onChange={(e) => setRaw({ ...raw, ramadans: e.target.value })} />
                  <span className={css.soft}>{T.EST_RAMADANS_NOTE}</span>
                </div>
              ) : (
                <div className={css.field}>
                  <label htmlFor="qada-fastdays">{T.EST_FAST_DAYS}</label>
                  <input id="qada-fastdays" className={`${css.input} ${css.narrow}`} inputMode="numeric" value={raw.fastDays} onChange={(e) => setRaw({ ...raw, fastDays: e.target.value })} />
                </div>
              )}
            </div>
          )}
          {msg && <div className={msg.ok ? hl.ok : hl.err}>{msg.text}</div>}
          <div className={hl.actionsRow}>
            <button type="button" className={`${hl.primaryBtn} pressable`} onClick={calc}>
              {T.EST_CALC}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={css.label} style={{ marginTop: 8 }}>
            {T.estPreviewTitle(view.you)}
          </div>
          <div className={css.inline}>
            {[...PRAYERS, ...(view.access.fasting ? (["FAST"] as const) : [])].map((k) => (
              <div key={k} className={css.field}>
                <label htmlFor={`qada-prev-${k}`}>{KIND_NAMES[k]}</label>
                <input
                  id={`qada-prev-${k}`}
                  className={`${css.input} ${css.narrow}`}
                  inputMode="numeric"
                  value={preview[k]}
                  onChange={(e) => setPreview({ ...preview, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
          {saved && <p className={css.soft}>{T.EST_REPLACE}</p>}
          {msg && <div className={msg.ok ? hl.ok : hl.err}>{msg.text}</div>}
          <div className={hl.actionsRow}>
            <button type="button" className={`${hl.primaryBtn} pressable`} onClick={save} aria-busy={pending}>
              {T.EST_SAVE}
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setPreview(null)}>
              {T.EST_BACK}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** The card's settings: her average excuse days (a woman's, a girl's for the list) and «حذف كل بيانات القضاء». */
function SettingsPanel({ view, subjectId, send, onClose }: PanelProps) {
  const [avg, setAvg] = useState(view.plan?.avg === null || view.plan?.avg === undefined ? "" : String(view.plan.avg));
  const [word, setWord] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<{ at: "avg" | "del"; text: string; ok?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const avgRef = useRef<HTMLInputElement>(null);
  const wordRef = useRef<HTMLInputElement>(null);
  return (
    <div className={css.panel}>
      <PanelHead title={T.BUTTONS.settings} onClose={onClose} />
      {view.plan && view.access.excuseAware && (
        <div className={css.field}>
          <label htmlFor="qada-avg">{T.AVG_TITLE}</label>
          <div className={css.inline}>
            <input id="qada-avg" ref={avgRef} className={`${css.input} ${css.narrow}`} inputMode="numeric" value={avg} onChange={(e) => setAvg(e.target.value)} />
            <button
              type="button"
              className={`${hl.ghostBtn} pressable`}
              aria-busy={pending}
              onClick={() => {
                const n = intOf(avg);
                if (!(n >= 0 && n <= LIMITS.maxExcuseDays)) {
                  setMsg({ at: "avg", text: T.ERR.avg });
                  return pointTo(avgRef.current);
                }
                start(async () => {
                  if (await send(() => setQadaAverageAction({ subjectId, zone: zone(), days: n }))) setMsg({ at: "avg", text: T.SAVED, ok: true });
                });
              }}
            >
              {T.SAVE}
            </button>
          </div>
          <span className={css.soft}>{T.avgNote(view.who)}</span>
          {msg?.at === "avg" && <div className={msg.ok ? hl.ok : hl.err}>{msg.text}</div>}
        </div>
      )}
      {view.access.deleteAll && (
        <div className={css.block}>
          <div className={`${css.label} ${css.dangerTitle}`}>{T.DELETE_ALL_TITLE}</div>
          <p className={css.soft}>{T.DELETE_ALL_NOTE}</p>
          {deleting ? (
            <>
              <div className={css.field}>
                <label htmlFor="qada-del">{T.deleteAllPrompt(view.you)}</label>
                <input id="qada-del" ref={wordRef} className={`${css.input} ${css.narrow}`} autoComplete="off" value={word} onChange={(e) => setWord(e.target.value)} />
              </div>
              {msg?.at === "del" && <div className={msg.ok ? hl.ok : hl.err}>{msg.text}</div>}
              <div className={hl.actionsRow}>
                <button
                  type="button"
                  className={`${css.danger} pressable`}
                  aria-busy={pending}
                  onClick={() => {
                    if (word.trim() !== T.QADA_DELETE_WORD) {
                      setMsg({ at: "del", text: T.ERR.deleteWord });
                      return pointTo(wordRef.current);
                    }
                    start(async () => {
                      if (await send(() => deleteAllQadaAction({ subjectId, zone: zone(), word: word.trim() }))) {
                        setDeleting(false);
                        setWord("");
                        setMsg({ at: "del", text: T.deletedAll, ok: true });
                      }
                    });
                  }}
                >
                  {T.DELETE_ALL_BUTTON}
                </button>
                <button type="button" className={hl.ghostBtn} onClick={() => setDeleting(false)}>
                  {T.BUTTONS.cancel}
                </button>
              </div>
            </>
          ) : (
            <>
              {msg?.at === "del" && msg.ok && <div className={hl.ok}>{msg.text}</div>}
              <button type="button" className={`${hl.ghostBtn} pressable`} onClick={() => setDeleting(true)}>
                {T.DELETE_ALL_TITLE}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
