"use client";

import { useEffect, useId, useRef, useState } from "react";
import { genderText } from "@/lib/guide/help/text";
import { splitQuestions, stepsFor } from "@/lib/guide/help/run";
import type { HelpQuestion, HelpStep } from "@/lib/guide/help/types";
import type { HelpHost } from "./host";
import { useHelpAvoidState } from "./help-avoid";
import { focusables } from "./focus";
import { Tour } from "./Tour";
import { onTourRequest } from "./tour-request";
import styles from "./help.module.css";

// The help on a page: the «؟ كيف أستخدم هذه الصفحة» button (bottom left, «؟»
// alone on a phone), its panel of questions, and the «أرِني» tour. Mounted
// by the guide's provider only while the guidance is on. Nothing here saves
// anything: opening, reading and touring write nothing; the only change a
// tour can make is a feature she switches on herself with «تفعيل الآن».

type Running<T extends string, P extends string> = { key: number; home: P; steps: HelpStep<T, P>[] };

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

  // a new page closes the panel (a running tour carries on there)
  const [seenPage, setSeenPage] = useState(host.page?.id ?? null);
  if (seenPage !== (host.page?.id ?? null)) {
    setSeenPage(host.page?.id ?? null);
    setOpen(false);
  }
  // arrived where an asked-for tour waits: it starts (anywhere else, it's dropped)
  const [seenHere, setSeenHere] = useState(host.here);
  if (seenHere !== host.here) {
    setSeenHere(host.here);
    if (waiting) {
      setWaiting(null);
      if (waiting.page === host.here) setTour({ key: Date.now(), home: waiting.page, steps: stepsFor(waiting.q, host.facts) });
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
          setTour({ key: Date.now(), home: page, steps: stepsFor(q, h.facts) });
          return;
        }
        const href = h.hrefOf(page);
        if (!href) return;
        setWaiting({ page, q });
        h.go(href);
      }),
    [],
  );

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function showMe(q: HelpQuestion<T, P>) {
    if (!host.page) return;
    returnTo.current = null;
    setOpen(false);
    setTour({ key: Date.now(), home: host.page.id, steps: stepsFor(q, host.facts) });
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
          <div className={styles.room} aria-hidden />
          <button
            ref={buttonRef}
            type="button"
            className={`${styles.button} ${avoid === "lift" ? styles.lift : ""} ${avoid === "hide" || tour ? styles.away : ""}`}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <span aria-hidden className={styles.mark}>
              {host.texts.buttonShort}
            </span>
            <span className={styles.long}>{host.texts.button.replace(/^؟\s*/, "")}</span>
          </button>
          {open && <Panel host={host} t={t} onClose={close} onShowMe={showMe} />}
        </>
      )}
      {tour && <Tour key={tour.key} host={host} home={tour.home} steps={tour.steps} onEnd={endTour} />}
    </>
  );
}

function Panel<T extends string, P extends string>({
  host,
  t,
  onClose,
  onShowMe,
}: {
  host: HelpHost<T, P>;
  t: (s: string) => string;
  onClose: () => void;
  onShowMe: (q: HelpQuestion<T, P>) => void;
}) {
  const page = host.page!;
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [openQ, setOpenQ] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const { visible, more: rest } = splitQuestions(page.questions);

  // focus into the panel; Tab stays inside it, Esc closes it
  useEffect(() => {
    const box = boxRef.current;
    box?.querySelector<HTMLElement>("button")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab" && box) {
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
  }, [onClose]);

  const item = (q: HelpQuestion<T, P>, n: number) => {
    const isOpen = openQ === n;
    const bodyId = `${titleId}-q${n}`;
    const steps = stepsFor(q, host.facts);
    return (
      <li key={n} className={styles.q}>
        <button type="button" className={styles.qBtn} aria-expanded={isOpen} aria-controls={bodyId} onClick={() => setOpenQ(isOpen ? null : n)}>
          <span>{t(q.q)}</span>
          <span className={styles.chev} aria-hidden />
        </button>
        <div id={bodyId} className={styles.qBody} hidden={!isOpen}>
          <ol className={styles.steps}>
            {steps.map((s, i) => (
              <li key={i}>{t(s.text)}</li>
            ))}
          </ol>
          {q.notes?.map((note, i) => (
            <p key={i} className={styles.note}>
              {t(note)}
            </p>
          ))}
          {q.showMe && (
            <button type="button" className={styles.primary} onClick={() => onShowMe(q)}>
              {host.texts.showMe}
            </button>
          )}
        </div>
      </li>
    );
  };

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
        <div className={styles.panelHead}>
          <h2 id={titleId} className={styles.panelTitle}>
            {host.texts.title(page.title)}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            {host.texts.close}
          </button>
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
      </div>
    </div>
  );
}
