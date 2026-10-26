"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { pointTo } from "@/components/nudge/nudge";
import { requestTour } from "@/components/guide/tour-request";
import { genderText } from "@/lib/guide/help/text";
import { checklistComplete, checklistItems, checklistProgress, type ChecklistFacts, type ChecklistItem } from "@/lib/guide/lines";
import { CHECKLIST, TOUR_FROM } from "@/lib/guide/lines-texts";
import { useGuide } from "../GuideProvider";
import styles from "./lines.module.css";

// «خطواتكِ الأولى» on «صفحتي» (review page ٢), a new account's only: three
// steps (four with the item-time one) that tick themselves from her own data (facts, read on the server),
// never by a tap. «إخفاء القائمة» hides it (back from the settings while not
// complete); once all are done, «أحسنتِ، بدأتِ على مُكث 🌿» shows once, then
// fades away.

const CELEBRATE_MS = 5000;
const FADE_MS = 200;

export function Checklist({ facts }: { facts: ChecklistFacts }) {
  const guide = useGuide();
  const t = (s: string) => genderText(s, guide.gender);
  const complete = checklistComplete(facts, guide.states);
  const d = guide.decide({ page: "home", checklistComplete: complete, hasTrackerItems: facts.trackerItems > 0 }).checklist;
  const [justHidden, setJustHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hiddenRef = useRef<HTMLParagraphElement>(null);
  // the completion line: shown once (marked as soon as it shows), then fading
  const [celebrating, setCelebrating] = useState<"on" | "leaving" | "over" | null>(null);
  if (d.celebrate && celebrating === null) setCelebrating("on");
  const { mark } = guide;
  useEffect(() => {
    if (celebrating === "on") void mark("checklist.celebrated");
  }, [celebrating, mark]);
  useEffect(() => {
    if (celebrating !== "on") return;
    const a = window.setTimeout(() => setCelebrating("leaving"), CELEBRATE_MS);
    return () => window.clearTimeout(a);
  }, [celebrating]);
  useEffect(() => {
    if (celebrating !== "leaving") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const b = window.setTimeout(() => setCelebrating("over"), reduce ? 0 : FADE_MS);
    return () => window.clearTimeout(b);
  }, [celebrating]);
  useEffect(() => {
    if (justHidden) hiddenRef.current?.focus({ preventScroll: true });
  }, [justHidden]);

  if (celebrating === "over") return null;
  if (celebrating) {
    return (
      <p className={`${styles.celebrate} ${celebrating === "leaving" ? styles.leaving : ""}`} role="status">
        {t(CHECKLIST.celebrate)}
      </p>
    );
  }
  if (justHidden && !d.show) {
    return (
      <p ref={hiddenRef} tabIndex={-1} className={`${styles.line}`} role="status">
        {t(CHECKLIST.hidden)}
      </p>
    );
  }
  if (!d.show) return null;

  const items = checklistItems(facts, guide.states);
  const { done, total } = checklistProgress(items);

  async function hide() {
    setError(null);
    setJustHidden(true);
    const r = await guide.mark("checklist.hidden");
    if (r.error) {
      setJustHidden(false);
      setError(r.error);
    }
  }

  return (
    <section className={styles.check} aria-labelledby="guide-checklist-title">
      <div className={styles.checkHead}>
        <h2 id="guide-checklist-title" className={styles.checkTitle}>
          {t(CHECKLIST.title)}
        </h2>
        <span className={styles.checkCount}>
          <span>{t(CHECKLIST.count(done, total))}</span>
          <button type="button" className={styles.linkBtn} onClick={hide}>
            {CHECKLIST.hide}
          </button>
        </span>
      </div>
      <p className={styles.lead}>{t(total === 2 ? CHECKLIST.leadTwo : total === 4 ? CHECKLIST.leadFour : CHECKLIST.lead)}</p>
      {error && (
        <p className={styles.fail} role="alert">
          {error}
        </p>
      )}
      <ol className={styles.items}>
        {items.map((item) => (
          <Item key={item.id} item={item} t={t} />
        ))}
      </ol>
    </section>
  );
}

function Item({ item, t }: { item: ChecklistItem; t: (s: string) => string }) {
  const words = item.id === "tracker" ? (item.add ? CHECKLIST.trackerAdd : CHECKLIST.trackerTick) : CHECKLIST[item.id];
  const btn = styles.itemBtn;
  let action: React.ReactNode = null;
  if (!item.done) {
    if (item.id === "session") {
      action = (
        <button type="button" className={btn} onClick={(e) => requestTour({ ...TOUR_FROM.session, from: e.currentTarget })}>
          {words.button}
        </button>
      );
    } else if (item.id === "times") {
      // with no item yet it waits: the press points to «أضيفي أول بندٍ» (never a dead button)
      action = (
        <button
          type="button"
          className={btn}
          onClick={(e) => {
            if (!item.waiting) return requestTour({ ...TOUR_FROM.times, from: e.currentTarget });
            const first = e.currentTarget.closest("ol")?.querySelector<HTMLElement>('[data-check="tracker"]');
            pointTo(first, { focus: false });
            first?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
          }}
        >
          {words.button}
        </button>
      );
    } else {
      const href = item.id === "homelog" ? "/rafiq/home-log" : item.id === "tracker" && item.add ? "/rafiq/tracker?add=1" : "/rafiq/tracker";
      action = (
        <Link href={href} className={btn}>
          {words.button}
        </Link>
      );
    }
  }
  return (
    <li className={`${styles.item} ${item.done ? styles.done : ""}`} data-check={item.id}>
      <span className={styles.mark} aria-hidden>
        {item.done ? "✓" : ""}
      </span>
      <span className={styles.itemTitle}>
        {t(words.title)}
        {item.done && <span className={styles.srOnly}>، {CHECKLIST.done}</span>}
      </span>
      <p className={styles.itemNote}>{t(words.note)}</p>
      {action}
    </li>
  );
}
