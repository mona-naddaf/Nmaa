"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import hl from "@/components/home-log/home-log.module.css";
import work from "@/components/student-work/work.module.css";
import css from "./excuse.module.css";
import { pointTo } from "@/components/nudge/nudge";
import { SavedNote } from "@/components/nudge/SavedNote";
import { LeaveGuard, trackSave } from "@/components/leave-guard/LeaveGuard";
import { parseClock } from "@/lib/tracker/agenda";
import { addDays } from "@/lib/tracker/rules";
import { checkEnd, checkStart, effectiveEnd, type Excuse, type Moment } from "@/lib/excuse/rules";
import {
  EXCUSE_CANCEL,
  EXCUSE_CONFIRM,
  EXCUSE_DAYS,
  EXCUSE_END,
  EXCUSE_END_TITLE,
  EXCUSE_ENDED,
  EXCUSE_OK,
  EXCUSE_START,
  EXCUSE_START_TITLE,
  EXCUSE_WHEN,
  excuseAutoEnded,
  momentErrorText,
  PAUSE_OPTION,
  PAUSE_RESUME,
  PAUSED_SUFFIX,
  pauseHint,
  sinceLabel,
} from "@/lib/excuse/texts";

// «أيام العذر» above «جدول المتابعة»: «بدء العذر», or while it lasts the
// line «معذورة منذ…» with «انتهى العذر». Each opens a small panel under it
// (never a pop-up): «الآن» or «في وقت سابق» (today or yesterday, a time).
// The panel mirrors the rules; the server checks them again and answers
// with the approved message. Shown only to whoever may start and end it.

// pause: «إيقاف الحفظ أيضًا» chosen in the start panel
export type ExcuseAction = (at: "NOW" | Moment, pause?: boolean) => Promise<{ error?: string; autoEnded?: boolean }>;

const FAIL = "تعذّر الحفظ، يُرجى المحاولة مرة أخرى";

/** Her moment now (the browser's day and minute). */
function localNow(): Moment {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { day, min: d.getHours() * 60 + d.getMinutes() };
}

export function ExcuseBar({
  excuses,
  you,
  self,
  onStart,
  onEnd,
  onSettle,
  pause,
}: {
  // hers, oldest first (the open one, if any, last)
  excuses: Excuse[];
  // whoever presses, for the wording
  you: "MALE" | "FEMALE";
  // she herself (C13's wording)
  self: boolean;
  onStart: ExcuseAction;
  onEnd: ExcuseAction;
  // an excuse found past its 15 days: the server ends it
  onSettle: () => Promise<{ autoEnded?: boolean }>;
  // «رفيق الحفظ» and the family: pausing memorization too (C4, C9); paused:
  // her open excuse has it paused now. Unset (courses): no such choice.
  pause?: { paused: boolean; onPause: (on: boolean) => Promise<{ error?: string; autoEnded?: boolean }> };
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<"start" | "end" | null>(null);
  const [note, setNote] = useState<"ended" | "auto" | null>(null);
  // C9: changed at once, saved in the background; put back with a message if saving fails
  const [paused, setPaused] = useState(pause?.paused ?? false);
  const [seenPaused, setSeenPaused] = useState(pause?.paused ?? false);
  if ((pause?.paused ?? false) !== seenPaused) {
    setSeenPaused(pause?.paused ?? false);
    setPaused(pause?.paused ?? false);
  }
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [pauseStamp, setPauseStamp] = useState(0);
  function togglePause() {
    if (!pause) return;
    const next = !paused;
    setPaused(next);
    setPauseError(null);
    setPauseStamp(0);
    trackSave(pause.onPause(next))
      .then((r) => {
        if (r.error) throw new Error(r.error);
        if (r.autoEnded) setNote("auto");
        setPauseStamp(Date.now());
        router.refresh();
      })
      .catch(() => {
        setPaused(!next);
        setPauseError(FAIL);
      });
  }
  const now = localNow();
  const open = excuses.find((e) => e.end === null && !effectiveEnd(e, now)) ?? null;
  const expired = excuses.some((e) => e.end === null && effectiveEnd(e, now)?.auto);
  const lastEnd = excuses.reduce<Moment | null>((last, e) => {
    const end = e.end ?? effectiveEnd(e, now)?.end ?? null;
    return end && (!last || end.day > last.day || (end.day === last.day && end.min > last.min)) ? end : last;
  }, null);

  // past its 15 days: ended by the server (asked once per visit), the notice once
  const settled = useRef(false);
  useEffect(() => {
    if (!expired || settled.current) return;
    settled.current = true;
    onSettle()
      .then((r) => {
        if (!r.autoEnded) return;
        setNote("auto");
        router.refresh();
      })
      .catch(() => {});
  }, [expired, onSettle, router]);

  // «انتهى العذر…✓» goes by itself
  useEffect(() => {
    if (note !== "ended") return;
    const t = window.setTimeout(() => setNote(null), 4000);
    return () => window.clearTimeout(t);
  }, [note]);

  return (
    <>
      {note === "auto" && (
        <div className={css.notice} role="status">
          <span style={{ flex: 1, minWidth: 200 }}>{excuseAutoEnded(self)}</span>
          <button type="button" className={`${hl.ghostBtn} pressable`} onClick={() => setNote(null)}>
            {EXCUSE_OK}
          </button>
        </div>
      )}
      {note === "ended" && (
        <div className={`${hl.ok} ${css.note}`} role="status">
          {EXCUSE_ENDED}
        </div>
      )}
      {panel === null && (
        <div className={css.bar}>
          {open ? (
            <>
              <span className={css.since}>
                {sinceLabel(open.start.day, now.day)}
                {pause && paused && ` · ${PAUSED_SUFFIX}`}
              </span>
              <button type="button" className={`${hl.ghostBtn} pressable`} onClick={() => (setNote(null), setPanel("end"))}>
                {EXCUSE_END}
              </button>
              {pause && (
                <span>
                  <button type="button" className={hl.linkBtn} aria-pressed={paused} onClick={togglePause}>
                    {paused ? PAUSE_RESUME : PAUSE_OPTION}
                  </button>
                  <SavedNote stamp={pauseStamp} />
                </span>
              )}
            </>
          ) : (
            <button type="button" className={`${hl.ghostBtn} pressable`} onClick={() => (setNote(null), setPanel("start"))}>
              {EXCUSE_START}
            </button>
          )}
        </div>
      )}
      {pauseError && (
        <div className={`${hl.err} ${css.note}`} role="alert">
          {pauseError}
        </div>
      )}
      {pause && <LeaveGuard you={you} />}
      {panel && (
        <WhenPanel
          key={panel}
          what={panel}
          you={you}
          pauseHint={pause && panel === "start" ? pauseHint(self) : undefined}
          check={(at, n) => (panel === "start" ? checkStart(at, n, lastEnd) : open ? checkEnd(at, n, open.start) : null)}
          other={panel === "start" ? lastEnd : (open?.start ?? null)}
          onCancel={() => setPanel(null)}
          onConfirm={async (at, withPause) => {
            const r = await (panel === "start" ? onStart : onEnd)(at, withPause);
            if (r.error) return r.error;
            setPanel(null);
            if (r.autoEnded) setNote("auto");
            else if (panel === "end") setNote("ended");
            router.refresh();
            return null;
          }}
        />
      )}
    </>
  );
}

/** «متى بدأ العذر؟» / «متى انتهى العذر؟»: now, or today/yesterday at a time. */
function WhenPanel({
  what,
  you,
  check,
  other,
  onCancel,
  onConfirm,
  pauseHint,
}: {
  what: "start" | "end";
  you: "MALE" | "FEMALE";
  // the start panel in «رفيق الحفظ» and the family: «إيقاف الحفظ أيضًا» (C4), with its hint
  pauseHint?: string;
  check: (at: Moment | null, now: Moment) => ReturnType<typeof checkStart>;
  // what an earlier time must come after (the last end / this start), for the message
  other: Moment | null;
  onCancel: () => void;
  // null: done; otherwise the message to show
  onConfirm: (at: "NOW" | Moment, pause: boolean) => Promise<string | null>;
}) {
  const [earlier, setEarlier] = useState(false);
  // unchecked at first
  const [pause, setPause] = useState(false);
  const [yesterday, setYesterday] = useState(false);
  const [time, setTime] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timeRef = useRef<HTMLInputElement>(null);
  const title = what === "start" ? EXCUSE_START_TITLE : EXCUSE_END_TITLE;

  function confirm() {
    const now = localNow();
    let at: "NOW" | Moment = "NOW";
    if (earlier) {
      const min = parseClock(time);
      const moment = min === null ? null : { day: yesterday ? addDays(now.day, -1) : now.day, min };
      const e = check(moment, now);
      if (e) {
        setProblem(momentErrorText(e, you, other, now.day));
        return pointTo(timeRef.current);
      }
      at = moment!;
    }
    setProblem(null);
    start(async () => {
      const message = await onConfirm(at, pause).catch(() => "تعذّر الحفظ، يُرجى المحاولة مرة أخرى");
      if (message) {
        setProblem(message);
        if (earlier) pointTo(timeRef.current);
      }
    });
  }

  return (
    <div className={css.panel} role="group" aria-label={title}>
      <div className={css.panelTitle}>{title}</div>
      <div className={work.pills} role="radiogroup" aria-label={title} style={{ marginBottom: 10 }}>
        {([false, true] as const).map((e) => (
          <button
            key={String(e)}
            type="button"
            role="radio"
            aria-checked={earlier === e}
            className={`${work.pill} ${earlier === e ? work.sel : ""}`}
            onClick={() => {
              setEarlier(e);
              setProblem(null);
            }}
          >
            {e ? EXCUSE_WHEN.EARLIER : EXCUSE_WHEN.NOW}
          </button>
        ))}
      </div>
      {earlier && (
        <div className={css.row}>
          <div className={work.pills} role="radiogroup" aria-label={EXCUSE_WHEN.EARLIER}>
            {([false, true] as const).map((y) => (
              <button
                key={String(y)}
                type="button"
                role="radio"
                aria-checked={yesterday === y}
                className={`${work.pill} ${yesterday === y ? work.sel : ""}`}
                onClick={() => {
                  setYesterday(y);
                  setProblem(null);
                }}
              >
                {y ? EXCUSE_DAYS.YESTERDAY : EXCUSE_DAYS.TODAY}
              </button>
            ))}
          </div>
          <input
            ref={timeRef}
            type="time"
            className={css.time}
            value={time}
            aria-label={title}
            onChange={(e) => {
              setTime(e.target.value);
              setProblem(null);
            }}
          />
        </div>
      )}
      {pauseHint && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={pause} onChange={(e) => setPause(e.target.checked)} />
            {PAUSE_OPTION}
          </label>
          <div className={css.hint}>{pauseHint}</div>
        </div>
      )}
      {problem && (
        <div className={hl.err} role="alert" style={{ marginBottom: 8 }}>
          {problem}
        </div>
      )}
      <div className={hl.actionsRow}>
        <button type="button" className={`${hl.primaryBtn} pressable`} onClick={confirm} disabled={pending}>
          {EXCUSE_CONFIRM}
        </button>
        <button type="button" className={`${hl.ghostBtn} pressable`} onClick={onCancel} disabled={pending}>
          {EXCUSE_CANCEL}
        </button>
      </div>
    </div>
  );
}
