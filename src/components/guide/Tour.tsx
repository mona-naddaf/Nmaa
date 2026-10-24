"use client";

import { useEffect, useId, useRef, useState } from "react";
import { genderText } from "@/lib/guide/help/text";
import { catchUp, nextPresses, onPress, progressLabel, stepView, type StepView } from "@/lib/guide/help/run";
import type { HelpFacts, HelpStep } from "@/lib/guide/help/types";
import type { HelpHost } from "./host";
import { focusables } from "./focus";
import styles from "./help.module.css";

// «أرِني»: the page is dimmed and blocked except for the lit element, which
// stays usable; a bubble beside it says the step. A step with no element of
// its own (filling in the form a button opened, pressing «نعم») leaves the
// whole page usable, with the last element still ringed. A button that opens
// something moves the tour on when pressed (and «التالي» presses it); a field
// or a section stays hers to use until she presses «التالي»; a save button is
// only pointed at. A step on another page continues there, and an element
// that isn't there says why: a feature to switch on («تفعيل الآن»), a city
// to pick, a limit reached, or «هذا الجزء غير موجود بعد».

// how long a step waits for its element after a press (a menu or dialog
// opening), after arriving on a page, and while a page is on its way
const AFTER_PRESS_MS = 1500;
const AFTER_ARRIVAL_MS = 2500;
const WHILE_LEAVING_MS = 15000;
const RING = 6;
const GUTTER = 16;
const GAP = 12;
const PHONE = 640;

type Rect = { top: number; left: number; width: number; height: number };
type View = StepView | "wait";
// via: the lit element is an opener of the step's element (a menu, a view);
// press: «التالي» presses something there (and the bubble says so)
type Geo = { view: View; rect: Rect | null; pos: { top: number; left: number } | null; vw: number; vh: number; via: boolean; press: boolean };

/** Shown on the screen: laid out, not hidden, not inside something closed (a menu fading out is inert). */
function visible(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0 || el.closest("[inert]")) return false;
  return el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
}

/** The first element on the page with this name that can be seen (or sits in a closed <details>). */
function findTarget(name: string): HTMLElement | null {
  // an element can carry several names, space-separated
  const all = [...document.querySelectorAll<HTMLElement>(`[data-guide~="${CSS.escape(name)}"]`)].filter((el) => !el.closest("[data-guide-root]"));
  return all.find(visible) ?? all.find((el) => el.closest("details:not([open])")) ?? null;
}

// what counts as pressing in a lit area: a control, not a click on its text
const CONTROL = 'button, a[href], summary, [role="button"], [role="tab"], [role="menuitem"], [role="radio"]';

/**
 * What «التالي» presses on a step that opens something: the lit element when
 * it is a control; in a lit section, its closed toggle, else its link. Never
 * anything else (a save button is a «save» step and is never pressed).
 */
function pressable(el: HTMLElement): HTMLElement | null {
  if (el.matches(CONTROL)) return el;
  return el.querySelector<HTMLElement>('[aria-expanded="false"]') ?? el.querySelector<HTMLElement>("a[href]");
}

const sameGeo = (a: Geo, b: Geo) =>
  a.view === b.view && a.vw === b.vw && a.vh === b.vh && a.via === b.via && a.press === b.press && JSON.stringify([a.rect, a.pos]) === JSON.stringify([b.rect, b.pos]);

type Live<T extends string, P extends string> = {
  step: HelpStep<T, P>;
  home: P;
  here: P | null;
  facts: HelpFacts;
  hrefOf: (page: P) => string | null;
  // which step (index and «leaving»), for scrolling to it once
  key: string;
  // until when a missing element may still be on its way
  waitUntil: number;
};

export function Tour<T extends string, P extends string>({
  host,
  home,
  steps,
  onEnd,
}: {
  host: HelpHost<T, P>;
  home: P;
  steps: HelpStep<T, P>[];
  onEnd: () => void;
}) {
  const [index, setIndex] = useState(0);
  // after a «leave» step was pressed: its page, with `then` lit; the tour ends there
  const [leaving, setLeaving] = useState(false);
  const [note, setNote] = useState<"enabled" | "failed" | null>(null);
  const [busy, setBusy] = useState(false);
  const [geo, setGeo] = useState<Geo>({ view: "wait", rect: null, pos: null, vw: 0, vh: 0, via: false, press: false });
  const textId = useId();
  const t = (s: string) => genderText(s, host.gender);

  // she went to a later step's page herself (a verse opened from a dialog): on to that step
  const [seenHere, setSeenHere] = useState(host.here);
  if (seenHere !== host.here) {
    setSeenHere(host.here);
    if (!leaving) {
      const to = catchUp(steps, index, home, host.here);
      if (to !== index) setIndex(to);
    }
  }

  const base = steps[index];
  const step: HelpStep<T, P> = leaving && base.then ? { text: base.text, target: base.then.target, page: base.then.page } : base;
  const last = leaving || index === steps.length - 1;

  // what the measuring, the keys and the clicks work from (brought up to date after each render)
  const live = useRef<Live<T, P>>({ step, home, here: host.here, facts: host.facts, hrefOf: host.hrefOf, key: "", waitUntil: 0 });
  const litRef = useRef<HTMLElement | null>(null);
  const lastLit = useRef<HTMLElement | null>(null);
  const scrolledFor = useRef<string | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const viewRef = useRef<View>("wait");
  // the openers pressed in this step, and whether the lit element is one
  const viaPressed = useRef(new Set<string>());
  const viaLit = useRef<string | null>(null);
  const frame = useRef(0);
  const timer = useRef(0);
  const act = useRef<{ next: (link: boolean) => void; end: () => void; leave: () => void }>({ next: () => {}, end: onEnd, leave: () => {} });

  // measures on the next frame; it reads only refs, so it never works from an old render
  const schedule = useRef(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(measure);
  }).current;

  function measure() {
    const s = live.current;
    const page = s.step.page ?? s.home;
    const onPage = page === s.here;
    let el = onPage && s.step.target ? findTarget(s.step.target) : null;
    const blockedEl = onPage && s.step.blocked ? findTarget(s.step.blocked.target) : null;
    let view: View = stepView(s.step, { here: s.here, home: s.home, found: !!el, blocked: !!blockedEl, facts: s.facts, hrefOf: s.hrefOf });
    // its element is inside something closed: the innermost opener showing, not pressed yet in this step
    let via: string | null = null;
    if (onPage && !el && view !== "blocked" && s.step.via) {
      for (const name of [...s.step.via].reverse()) {
        if (viaPressed.current.has(name)) continue;
        const opener = findTarget(name);
        if (opener) {
          el = opener;
          via = name;
          view = "show";
          break;
        }
      }
    }
    viaLit.current = via;
    const left = s.waitUntil - Date.now();
    if (left > 0 && view !== "show" && view !== "plain") {
      view = "wait";
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(schedule, left + 20);
    }
    // the element to light: the step's own, the limit message, or (a step
    // with nothing of its own) the last one lit, while it's still there
    if (view === "blocked") el = blockedEl;
    else if (view === "plain") el = lastLit.current?.isConnected && lastLit.current.getClientRects().length ? lastLit.current : null;
    else if (view !== "show") el = null;
    if (view === "show" && el && !via) {
      lastLit.current = el;
      // a closed <details> around it opens (only what is shown changes)
      for (let d = el.closest("details:not([open])"); d; d = el.closest("details:not([open])")) (d as HTMLDetailsElement).open = true;
    }
    litRef.current = el;
    viewRef.current = view;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bubble = bubbleRef.current;
    const bw = bubble?.offsetWidth ?? 0;
    const bh = bubble?.offsetHeight ?? 0;
    let rect: Rect | null = null;
    if (el) {
      let r = el.getBoundingClientRect();
      const key = `${s.key}:${view}:${via}`;
      if (scrolledFor.current !== key) {
        scrolledFor.current = key;
        // into view when it isn't, leaving room for a docked bubble
        const room = vw < PHONE ? bh + GUTTER : 0;
        if (r.top < GUTTER || r.bottom > vh - GUTTER - room) {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
          r = el.getBoundingClientRect();
        }
      }
      rect = { top: r.top - RING, left: r.left - RING, width: r.width + 2 * RING, height: r.height + 2 * RING };
    }

    // the bubble: beside the element on a wide screen (below, else above),
    // docked at the bottom on a phone (at the top when the element is low)
    let pos: Geo["pos"] = null;
    if (bubble) {
      if (!rect || vw < PHONE) {
        const dockTop = rect !== null && rect.top + rect.height / 2 > vh / 2;
        pos = { left: Math.max(GUTTER, (vw - bw) / 2), top: dockTop ? GUTTER : vh - bh - GUTTER };
      } else {
        const x = Math.min(Math.max(GUTTER, rect.left + rect.width - bw), vw - bw - GUTTER);
        const below = rect.top + rect.height + GAP;
        const above = rect.top - GAP - bh;
        pos = { left: x, top: below + bh <= vh - GUTTER ? below : above >= GUTTER ? above : vh - bh - GUTTER };
      }
    }
    const press = view === "show" && el !== null && (via !== null || nextPresses(s.step)) && pressable(el) !== null;
    const next: Geo = { view, rect, pos, vw, vh, via: via !== null, press };
    setGeo((g) => (sameGeo(g, next) ? g : next));
  }

  // after every render: what measuring uses is brought up to date, and it measures again
  useEffect(() => {
    const was = live.current;
    live.current = { ...was, step, home, here: host.here, facts: host.facts, hrefOf: host.hrefOf, key: `${index}:${leaving}` };
    // arrived on another page, or her settings came back changed: what is
    // awaited is there now or very soon
    if (was.here !== host.here || was.facts !== host.facts) {
      live.current.waitUntil = Math.min(Math.max(was.waitUntil, Date.now()), Date.now() + AFTER_ARRIVAL_MS);
      if (was.here !== host.here) live.current.waitUntil = Date.now() + AFTER_ARRIVAL_MS;
    }
    act.current = { next: (link: boolean) => next(link ? "link" : "press"), end: onEnd, leave };
    schedule();
  });

  // the page moving or changing: measure again (not for the tour's own parts)
  useEffect(() => {
    const mo = new MutationObserver((records) => {
      if (records.some((r) => !(r.target as Element).closest?.("[data-guide-root]"))) schedule();
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      mo.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame.current);
      window.clearTimeout(timer.current);
    };
  }, [schedule]);

  function wait(ms: number) {
    live.current.waitUntil = Date.now() + ms;
  }

  // pressed: something opening, or a link (a page on its way)
  function next(pressed: "press" | "link" | null = null) {
    setNote(null);
    if (last) return onEnd();
    wait(pressed === "link" ? WHILE_LEAVING_MS : pressed ? AFTER_PRESS_MS : 0);
    viaPressed.current.clear();
    setIndex((i) => i + 1);
  }

  function back() {
    setNote(null);
    wait(0);
    viaPressed.current.clear();
    setIndex((i) => Math.max(0, i - 1));
  }

  function pressNext() {
    // «التالي» presses only a button that opens something, never one that saves;
    // the press itself then moves the tour on
    // an opener lit in its place is pressed too: it only opens a menu or a view
    const control = geo.press && litRef.current ? pressable(litRef.current) : null;
    if (control) {
      control.click();
      return;
    }
    next();
  }

  function leave() {
    wait(WHILE_LEAVING_MS);
    setNote(null);
    setLeaving(true);
  }

  function go(page: P) {
    const href = host.hrefOf(page);
    if (!href) return;
    wait(WHILE_LEAVING_MS);
    host.go(href);
  }

  async function enable() {
    if (busy || !step.needs || step.needs === "city") return;
    setBusy(true);
    const r = await host.enable(step.needs).catch(() => ({ error: "failed" }));
    setBusy(false);
    if (r.error) return setNote("failed");
    setNote("enabled");
    // the page comes back with the feature on
    wait(WHILE_LEAVING_MS);
    schedule();
  }

  // a press on the lit element moves on when it opens something; Tab goes
  // round the lit element and the bubble; Esc ends the tour
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = litRef.current;
      if (!el || viewRef.current !== "show" || !el.contains(e.target as Node)) return;
      // a press on a control in the lit area (the element itself, or a toggle or link in it)
      const control = (e.target as Element).closest(CONTROL);
      if (!control || !(el.contains(control) || control.contains(el))) return;
      // an opener: the step's own element shows next (or the next opener)
      if (viaLit.current) {
        viaPressed.current.add(viaLit.current);
        live.current.waitUntil = Date.now() + AFTER_PRESS_MS;
        window.setTimeout(schedule);
        return;
      }
      const what = onPress(live.current.step);
      // after the page has handled the press
      if (what === "next") window.setTimeout(() => act.current.next(control.matches("a[href]")));
      else if (what === "then") window.setTimeout(() => act.current.leave());
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        act.current.end();
      } else if (e.key === "Tab" && bubbleRef.current && viewRef.current !== "plain") {
        const list = [...(litRef.current ? focusables(litRef.current) : []), ...focusables(bubbleRef.current)];
        if (list.length === 0) return;
        const at = list.indexOf(document.activeElement as HTMLElement);
        const to = e.shiftKey ? (at <= 0 ? list.length - 1 : at - 1) : at === -1 || at === list.length - 1 ? 0 : at + 1;
        e.preventDefault();
        list[to].focus();
      }
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [schedule]);

  // each new step: the focus on its main button (the screen reader hears the step from the status line),
  // once the bubble is placed (a hidden button can't take the focus)
  const placed = geo.pos !== null;
  useEffect(() => {
    if (geo.view !== "wait" && placed) primaryRef.current?.focus({ preventScroll: true });
  }, [index, leaving, geo.view, note, placed]);

  const { view, rect, pos, vw, vh } = geo;
  const page = step.page ?? home;
  const counted = view === "show" || view === "plain";
  const progress = progressLabel(index, steps.length);
  const enabledLine = note === "enabled" && <p className={styles.ok}>{t(host.texts.enabled)}</p>;

  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;
  if (counted) {
    body = (
      <>
        {enabledLine}
        <p id={textId} className={styles.bubbleText}>
          {t(step.text)}
        </p>
        {view === "show" && geo.press && <p className={styles.bubbleHint}>{t(host.texts.pressOrNext)}</p>}
        {!leaving && <p className={styles.count}>{progress}</p>}
      </>
    );
    actions = (
      <>
        {index > 0 && !leaving && (
          <button type="button" className={styles.secondary} onClick={back}>
            {host.texts.prev}
          </button>
        )}
        <button ref={primaryRef} type="button" className={styles.primary} onClick={pressNext}>
          {last ? host.texts.done : host.texts.next}
        </button>
        {!last && (
          <button type="button" className={styles.endLink} onClick={onEnd}>
            {host.texts.end}
          </button>
        )}
      </>
    );
  } else if (view === "away") {
    body = <p className={styles.bubbleText}>{host.texts.away(host.title(page))}</p>;
    actions = (
      <>
        <button ref={primaryRef} type="button" className={styles.primary} onClick={() => go(page)}>
          {host.texts.go(host.title(page))}
        </button>
        <button type="button" className={styles.secondary} onClick={onEnd}>
          {host.texts.cancel}
        </button>
      </>
    );
  } else if (view === "offer" && step.needs && step.needs !== "city") {
    body = (
      <>
        <p className={styles.bubbleText}>{t(host.offers[step.needs])}</p>
        {note === "failed" && (
          <p className={styles.err} role="alert">
            {host.texts.enableFailed}
          </p>
        )}
      </>
    );
    actions = (
      <>
        <button ref={primaryRef} type="button" className={styles.primary} aria-busy={busy} onClick={enable}>
          {host.texts.enableNow}
        </button>
        <button type="button" className={styles.secondary} onClick={onEnd}>
          {host.texts.noThanks}
        </button>
      </>
    );
  } else if (view === "city") {
    body = <p className={styles.bubbleText}>{t(host.texts.city)}</p>;
    actions = (
      <>
        <button
          ref={primaryRef}
          type="button"
          className={styles.primary}
          onClick={() => {
            host.go(host.cityHref);
            onEnd();
          }}
        >
          {host.texts.toSettings}
        </button>
        <button type="button" className={styles.secondary} onClick={onEnd}>
          {host.texts.noThanks}
        </button>
      </>
    );
  } else if (view === "blocked" || view === "missing") {
    body = (
      <>
        {enabledLine}
        {view === "missing" && <p className={styles.bubbleTitle}>{host.texts.missingTitle}</p>}
        <p className={styles.bubbleText}>{t(view === "blocked" ? step.blocked!.text : (step.missing ?? step.text))}</p>
      </>
    );
    actions = (
      <button ref={primaryRef} type="button" className={styles.primary} onClick={onEnd}>
        {host.texts.ok}
      </button>
    );
  }

  // a step with nothing of its own to light: nothing blocked
  const open = view === "plain";
  const hole = rect && {
    top: Math.max(0, rect.top),
    left: Math.max(0, rect.left),
    right: Math.min(vw, rect.left + rect.width),
    bottom: Math.min(vh, rect.top + rect.height),
  };

  return (
    <div className={styles.tour} data-guide-root="">
      {/* everything but the lit element is dimmed and can't be pressed */}
      {open ? (
        rect && <div className={styles.ring} style={{ width: rect.width, height: rect.height, transform: `translate(${rect.left}px, ${rect.top}px)` }} aria-hidden />
      ) : rect && hole ? (
        <>
          <div className={styles.block} style={{ top: 0, left: 0, width: vw, height: hole.top }} />
          <div className={styles.block} style={{ top: hole.bottom, left: 0, width: vw, height: Math.max(0, vh - hole.bottom) }} />
          <div className={styles.block} style={{ top: hole.top, left: 0, width: hole.left, height: Math.max(0, hole.bottom - hole.top) }} />
          <div
            className={styles.block}
            style={{ top: hole.top, left: hole.right, width: Math.max(0, vw - hole.right), height: Math.max(0, hole.bottom - hole.top) }}
          />
          <div className={styles.ring} style={{ width: rect.width, height: rect.height, transform: `translate(${rect.left}px, ${rect.top}px)` }} aria-hidden />
        </>
      ) : (
        <div className={styles.block} style={{ inset: 0 }} />
      )}
      <p className={styles.srOnly} role="status">
        {counted ? host.texts.step(progress, t(step.text)) : ""}
      </p>
      {view !== "wait" && (
        <div
          key={`${index}:${leaving}:${view}`}
          ref={bubbleRef}
          className={styles.bubble}
          role="dialog"
          aria-modal="false"
          aria-describedby={counted ? textId : undefined}
          style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden" }}
        >
          {body}
          <div className={styles.bubbleActions}>{actions}</div>
        </div>
      )}
    </div>
  );
}
