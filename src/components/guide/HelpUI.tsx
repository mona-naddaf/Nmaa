"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { genderText } from "@/lib/guide/help/text";
import { isTap, panelShows, questionsFor, splitQuestions, stepsFor, tourFor } from "@/lib/guide/help/run";
import type { EnableFeature, HelpQuestion, HelpStep } from "@/lib/guide/help/types";
import type { HelpHost } from "./host";
import { useHelpAvoidState, type HelpAvoid } from "./help-avoid";
import { focusables } from "./focus";
import { Tour } from "./Tour";
import { onTourRequest } from "./tour-request";
import styles from "./help.module.css";

// The help on a page: the «؟ كيف أستخدم هذه الصفحة» button (bottom left, «؟»
// alone on a phone), its panel of questions, and the «أرِني» tour. Mounted
// by the guide's provider only while the guidance is on. Nothing here saves
// anything: opening, reading and touring write nothing; the only change a
// tour can make is a feature she switches on herself with «تفعيل الآن».

// the same width as the styles' phone rules
const PHONE = "(max-width: 640px)";

function subscribePhone(onChange: () => void) {
  const m = window.matchMedia(PHONE);
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}

const usePhone = () =>
  useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );

type Running<T extends string, P extends string> = { key: number; home: P; title: string; steps: HelpStep<T, P>[] };

export function HelpUI<T extends string, P extends string>({ host }: { host: HelpHost<T, P> }) {
  const [open, setOpen] = useState(false);
  const [tour, setTour] = useState<Running<T, P> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const avoid = useHelpAvoidState();
  const t = (s: string) => genderText(s, host.gender);

  // a tour asked for from outside the panel: the button that asked, and one
  // waiting for its page to open
  const returnTo = useRef<HTMLElement | null>(null);
  const [waiting, setWaiting] = useState<{ page: P; q: HelpQuestion<T, P> } | null>(null);
  const hostRef = useRef(host);
  useEffect(() => {
    hostRef.current = host;
  });

  const preview = host.preview === true;

  // a new page closes the panel (a running tour carries on there); with the
  // new panel a new path does, so one verse to the next closes it too and a
  // change in the address's query doesn't
  const place = preview ? host.path : (host.page?.id ?? null);
  const [seenPage, setSeenPage] = useState(place);
  if (seenPage !== place) {
    setSeenPage(place);
    setOpen(false);
  }
  // arrived where an asked-for tour waits: it starts (anywhere else, it's dropped)
  const [seenHere, setSeenHere] = useState(host.here);
  if (seenHere !== host.here) {
    setSeenHere(host.here);
    if (waiting) {
      setWaiting(null);
      // (during render: a new key from the last one, not the clock)
      if (waiting.page === host.here) setTour((cur) => ({ key: (cur?.key ?? 0) + 1, home: waiting.page, ...tourFor(waiting.q, host.facts) }));
    }
  }

  useEffect(
    () =>
      onTourRequest((req) => {
        const h = hostRef.current;
        const page = req.page as P;
        const q = h.helpOf(page)?.questions.find((x) => x.q === req.question);
        if (!q) return;
        returnTo.current = req.from ?? null;
        setOpen(false);
        if (h.here === page) {
          setTour({ key: Date.now(), home: page, ...tourFor(q, h.facts) });
          return;
        }
        const href = h.hrefOf(page);
        if (!href) return;
        setWaiting({ page, q });
        h.go(href);
      }),
    [],
  );

  // stable: the panel's effects depend on it, and a new render mustn't move her focus
  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  function showMe(q: HelpQuestion<T, P>) {
    if (!host.page) return;
    returnTo.current = null;
    setOpen(false);
    setTour({ key: Date.now(), home: host.page.id, ...tourFor(q, host.facts) });
  }

  function endTour() {
    setTour(null);
    // after the tour the focus goes back to the button that asked for it,
    // else to «؟» (when the page has it)
    const from = returnTo.current;
    returnTo.current = null;
    requestAnimationFrame(() => (from?.isConnected && from.getClientRects().length ? from.focus() : buttonRef.current?.focus()));
  }

  return (
    <>
      {host.page && (
        <>
          {/* room under the last item, so the button never covers it */}
          <div className={preview ? styles.roomSafe : styles.room} aria-hidden />
          <button
            ref={buttonRef}
            type="button"
            className={`${styles.button} ${preview ? styles.raised : ""} ${avoid === "lift" ? styles.lift : ""} ${avoid === "hide" || tour ? styles.away : ""}`}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => (preview && open ? close() : setOpen(true))}
          >
            <span aria-hidden className={styles.mark}>
              {host.texts.buttonShort}
            </span>
            <span className={styles.long}>{host.texts.button.replace(/^؟\s*/, "")}</span>
          </button>
          {open && <Panel host={host} t={t} onClose={close} onShowMe={showMe} toggle={buttonRef} avoid={avoid} />}
        </>
      )}
      {tour && <Tour key={tour.key} host={host} home={tour.home} title={tour.title} steps={tour.steps} onEnd={endTour} />}
    </>
  );
}

function Panel<T extends string, P extends string>({
  host,
  t,
  onClose,
  onShowMe,
  toggle,
  avoid,
}: {
  host: HelpHost<T, P>;
  t: (s: string) => string;
  onClose: () => void;
  onShowMe: (q: HelpQuestion<T, P>) => void;
  // «؟»: pressing it isn't a tap on the page
  toggle: RefObject<HTMLButtonElement | null>;
  avoid: HelpAvoid | null;
}) {
  const page = host.page!;
  const preview = host.preview === true;
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [openQ, setOpenQ] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const { visible, more: rest } = splitQuestions(questionsFor(page.questions, host.facts));
  const phone = usePhone();
  const [folded, setFolded] = useState(false);
  const collapsed = preview && phone && folded;
  const moveFocus = useRef(false);
  // «تفعيل الآن» in a question: on its way, failed, and done (the steps show
  // at once; the fresh facts follow from the server)
  const [enabling, setEnabling] = useState(false);
  const [enableFailed, setEnableFailed] = useState<number | null>(null);
  const [enabledHere, setEnabledHere] = useState<EnableFeature | null>(null);

  async function enable(feature: EnableFeature, n: number) {
    setEnabling(true);
    setEnableFailed(null);
    const r = await host.enable(feature).catch(() => ({ error: "failed" }));
    setEnabling(false);
    if (r.error) return setEnableFailed(n);
    setEnabledHere(feature);
    // the button she pressed is gone: the focus goes to its question
    document.getElementById(`${titleId}-btn${n}`)?.focus({ preventScroll: true });
  }

  // focus into the panel, once
  useEffect(() => {
    boxRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);

  // Esc closes it. The old panel keeps Tab inside it; the new one isn't modal:
  // Tab goes on to the page, and a menu or dialog of the page that has the
  // focus closes first
  useEffect(() => {
    const box = boxRef.current;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const layer = preview ? (document.activeElement?.closest('[role="dialog"],[role="menu"]') ?? null) : null;
        if (layer && !box?.contains(layer)) return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (!preview && e.key === "Tab" && box) {
        const list = focusables(box);
        if (list.length === 0) return;
        const at = list.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (at <= 0 ? list.length - 1 : at - 1) : at === list.length - 1 ? 0 : at + 1;
        e.preventDefault();
        list[next].focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, preview]);

  // a phone: the first tap on the page collapses the panel and still does
  // what it does there. Pointer events, because a click on a plain element
  // isn't reliable on iOS; a scroll ends in pointercancel or moves, so it
  // doesn't count
  useEffect(() => {
    if (!preview || !phone) return;
    let down: { x: number; y: number } | null = null;
    const ours = (node: EventTarget | null) => node instanceof Node && (boxRef.current?.contains(node) || toggle.current?.contains(node));
    const onDown = (e: PointerEvent) => {
      down = e.isPrimary && !ours(e.target) ? { x: e.clientX, y: e.clientY } : null;
    };
    const onUp = (e: PointerEvent) => {
      if (down && isTap(down, { x: e.clientX, y: e.clientY })) {
        moveFocus.current = contentRef.current?.contains(document.activeElement) ?? false;
        setFolded(true);
      }
      down = null;
    };
    const onCancel = () => {
      down = null;
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onCancel, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onCancel, true);
    };
  }, [preview, phone, toggle]);

  // the focus was in what just collapsed: it goes to the bar; back open, to
  // the open question, or else the close button
  const wasCollapsed = useRef(false);
  useEffect(() => {
    if (collapsed === wasCollapsed.current) return;
    wasCollapsed.current = collapsed;
    if (collapsed) {
      if (moveFocus.current) barRef.current?.focus({ preventScroll: true });
    } else (document.getElementById(`${titleId}-btn${openQ}`) ?? closeRef.current)?.focus({ preventScroll: true });
    moveFocus.current = false;
  }, [collapsed, openQ, titleId]);

  const item = (q: HelpQuestion<T, P>, n: number) => {
    const isOpen = openQ === n;
    const bodyId = `${titleId}-q${n}`;
    const steps = stepsFor(q, host.facts);
    const offer = q.offer && q.offer.feature !== enabledHere && panelShows(q, host.facts) === "offer" ? q.offer : null;
    const showMe = q.showMe && !offer && (
      <button type="button" className={styles.primary} style={preview ? { marginBottom: 10 } : undefined} onClick={() => onShowMe(q)}>
        {host.texts.showMe}
      </button>
    );
    return (
      <li key={n} className={styles.q}>
        <button
          id={`${titleId}-btn${n}`}
          type="button"
          className={styles.qBtn}
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => setOpenQ(isOpen ? null : n)}
        >
          <span>{t(q.q)}</span>
          <span className={styles.chev} aria-hidden />
        </button>
        <div id={bodyId} className={styles.qBody} hidden={!isOpen}>
          {preview && showMe}
          {offer ? (
            <>
              <p className={styles.offerText}>{t(offer.text)}</p>
              <button type="button" className={styles.primary} disabled={enabling} onClick={() => enable(offer.feature, n)}>
                {host.texts.enableNow}
              </button>
              {enableFailed === n && (
                <p className={styles.err} role="alert">
                  {host.texts.enableFailed}
                </p>
              )}
            </>
          ) : (
            <>
              <ol className={styles.steps}>
                {steps.map((s, i) => (
                  <li key={i}>
                    {t(s.text)}
                    {s.options && (
                      <ul className={styles.options}>
                        {s.options.map((o) => (
                          <li key={o}>{t(o)}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
              {q.notes?.map((note, i) => (
                <p key={i} className={styles.note}>
                  {t(note)}
                </p>
              ))}
            </>
          )}
          {!preview && showMe}
        </div>
      </li>
    );
  };

  const panelTitle = host.texts.title(page.title);
  const content = (
    <>
      <div className={styles.panelHead}>
        <h2 id={titleId} className={styles.panelTitle}>
          {panelTitle}
        </h2>
        {preview ? (
          <button ref={closeRef} type="button" className={styles.closeX} aria-label={host.texts.close} onClick={onClose}>
            <span aria-hidden>✕</span>
          </button>
        ) : (
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            {host.texts.close}
          </button>
        )}
      </div>
      <p className={styles.lead}>{t(host.texts.lead)}</p>
      <ul className={styles.qs}>{visible.map((q, i) => item(q, i))}</ul>
      {rest.length > 0 && (
        <>
          <button type="button" className={styles.moreBtn} aria-expanded={more} aria-controls={`${titleId}-more`} onClick={() => setMore(!more)}>
            <span>{host.texts.more}</span>
            <span className={styles.chev} aria-hidden />
          </button>
          <ul id={`${titleId}-more`} className={styles.qs} hidden={!more}>
            {rest.map((q, i) => item(q, visible.length + i))}
          </ul>
        </>
      )}
    </>
  );

  if (!preview) {
    return (
      <div className={styles.backdrop} onClick={onClose} data-guide-root="">
        <div
          ref={boxRef}
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    );
  }

  const openQuestion = openQ === null ? undefined : [...visible, ...rest][openQ];
  const barTitle = openQuestion ? t(openQuestion.q) : panelTitle;
  return (
    <div
      className={`${styles.dock} ${avoid === "lift" && (!phone || collapsed) ? styles.dockLift : ""} ${avoid === "hide" ? styles.away : ""}`}
      data-guide-root=""
    >
      <div ref={boxRef} className={`${styles.sheet} ${collapsed ? styles.folded : ""}`} role="dialog" aria-labelledby={titleId}>
        {collapsed && (
          <button
            ref={barRef}
            type="button"
            className={styles.bar}
            aria-expanded={false}
            aria-label={`${host.texts.expand}: ${barTitle}`}
            onClick={() => setFolded(false)}
          >
            <span className={styles.barTitle}>{barTitle}</span>
          </button>
        )}
        <div ref={contentRef} className={`${styles.scroll} ${collapsed ? styles.faded : ""}`} inert={collapsed}>
          {content}
        </div>
      </div>
    </div>
  );
}
