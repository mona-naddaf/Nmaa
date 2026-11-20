"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HelpUI } from "@/components/guide/HelpUI";
import type { HelpHost } from "@/components/guide/host";
import { GuideTargets } from "@/components/guide/targets";
import { focusables } from "@/components/guide/focus";
import { requestTour } from "@/components/guide/tour-request";
import { genderText } from "@/lib/guide/help/text";
import type { GuideTarget } from "@/lib/guide/help/targets";
import type { HelpFacts } from "@/lib/guide/help/types";
import { FEATURE_OFFER, HELP_UI, PRESS_LABELS } from "@/lib/guide/help/rafiq/ui";
import { coursePageFor, courseHrefOf } from "@/lib/guide/help/course/pages";
import type { CoursePageId } from "@/lib/guide/help/course/types";
import { COURSE_GUIDE_COOKIE_DAYS, writeCourseGuide, type CourseGuideKey } from "@/lib/guide/course-keys";
import { COURSE_ANNOUNCE, COURSE_ANNOUNCE_CLOSE, COURSE_CHECKLIST, COURSE_GOT_IT } from "@/lib/guide/course-texts";
import type { CourseChecklistItem, CourseGuideProps } from "@/lib/guide/course-guide";
import styles from "@/app/rafiq/(app)/guide/lines.module.css";

// The courses' guide on a page (COURSE_GUIDE_EMAILS): the elements' names for
// «أرِني», one line above the page (a new user's welcome line with «فهمت», or
// an existing user's one line announcing «؟»), the supervisor's «الخطوات
// الأولى» on «قائمة الطلاب», and «؟» itself (../HelpUI). Everything comes
// ready from the server for this viewer (src/lib/guide/course-guide.ts);
// what she dismisses is kept in a cookie on her device.

// the course's help never needs Rafiq's own facts: no «needs», no conditions
const FACTS: HelpFacts = {
  features: { agenda: false, summary: false, similar: false, tajweed: false, review: false },
  city: false,
  plan: true,
  founder: false,
};

const CELEBRATE_MS = 5000;

export function CourseGuide({ guide, children }: { guide: CourseGuideProps; children: React.ReactNode }) {
  const [marks, setMarks] = useState<Set<CourseGuideKey>>(() => new Set(guide.marks));
  const mark = (key: CourseGuideKey) => {
    setMarks((cur) => {
      const next = new Set(cur).add(key);
      try {
        const secure = window.location.protocol === "https:" ? "; secure" : "";
        document.cookie = `${guide.cookie}=${writeCourseGuide(next)}; path=/; max-age=${COURSE_GUIDE_COOKIE_DAYS * 86400}; samesite=lax${secure}`;
      } catch {
        // no cookies: dismissed for this visit only
      }
      return next;
    });
  };
  return (
    <GuideTargets on>
      <Lines guide={guide} marks={marks} mark={mark} />
      {children}
      <CourseHelp guide={guide} />
    </GuideTargets>
  );
}

function Lines({ guide, marks, mark }: { guide: CourseGuideProps; marks: Set<CourseGuideKey>; mark: (k: CourseGuideKey) => void }) {
  const pathname = usePathname();
  const page = coursePageFor(guide.host, pathname);
  const t = (s: string) => genderText(s, guide.gender);
  const box = useRef<HTMLDivElement>(null);

  // after «فهمت» or «×», the focus goes on to what follows the line on the page
  const dismiss = (key: CourseGuideKey) => {
    const after = box.current ? focusables(document.body).find((el) => box.current!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !box.current!.contains(el)) : null;
    mark(key);
    after?.focus({ preventScroll: true });
  };

  const welcome = page ? guide.welcome[page] : undefined;
  let line: React.ReactNode = null;
  if (page && welcome && !marks.has(`w.${page}`)) {
    line = (
      <div ref={box} className={styles.line}>
        <p className={styles.lineText}>{t(welcome)}</p>
        <div className={styles.lineActions}>
          <button type="button" className={styles.btn} onClick={() => dismiss(`w.${page}`)}>
            {COURSE_GOT_IT}
          </button>
        </div>
      </div>
    );
  } else if (page && guide.announce && !marks.has("ann")) {
    line = (
      <div ref={box} className={`${styles.line} ${styles.intro}`} role="status">
        <p className={styles.lineText}>{COURSE_ANNOUNCE}</p>
        <div className={styles.lineActions}>
          <button type="button" className={styles.close} aria-label={COURSE_ANNOUNCE_CLOSE} title={COURSE_ANNOUNCE_CLOSE} onClick={() => dismiss("ann")}>
            ×
          </button>
        </div>
      </div>
    );
  }
  return (
    <>
      {line}
      {page === "s.students" && guide.checklist && <Checklist items={guide.checklist} t={t} marks={marks} mark={mark} />}
    </>
  );
}

function Checklist({ items, t, marks, mark }: { items: CourseChecklistItem[]; t: (s: string) => string; marks: Set<CourseGuideKey>; mark: (k: CourseGuideKey) => void }) {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const complete = done === total;
  const [justHidden, setJustHidden] = useState(false);
  const [celebrating, setCelebrating] = useState<"on" | "over" | null>(null);
  if (complete && celebrating === null && !marks.has("cl.done")) setCelebrating("on");
  const hiddenRef = useRef<HTMLParagraphElement>(null);
  // the completion line is shown once: marked as soon as it shows, gone after a few seconds
  useEffect(() => {
    if (celebrating !== "on") return;
    mark("cl.done");
    const a = window.setTimeout(() => setCelebrating("over"), CELEBRATE_MS);
    return () => window.clearTimeout(a);
    // mark is stable enough for this one-time effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrating]);
  useEffect(() => {
    if (justHidden) hiddenRef.current?.focus({ preventScroll: true });
  }, [justHidden]);

  if (celebrating === "on") {
    return (
      <p className={styles.celebrate} role="status">
        {t(COURSE_CHECKLIST.celebrate)}
      </p>
    );
  }
  if (celebrating === "over") return null;
  if (justHidden) {
    return (
      <p ref={hiddenRef} tabIndex={-1} className={styles.line} role="status">
        {t(COURSE_CHECKLIST.hidden)}
      </p>
    );
  }
  if (marks.has("cl.hidden") || marks.has("cl.done")) return null;

  return (
    <section className={styles.check} aria-labelledby="course-checklist-title">
      <div className={styles.checkHead}>
        <h2 id="course-checklist-title" className={styles.checkTitle}>
          {COURSE_CHECKLIST.title}
        </h2>
        <span className={styles.checkCount}>
          <span>{t(COURSE_CHECKLIST.count(done, total))}</span>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => {
              setJustHidden(true);
              mark("cl.hidden");
            }}
          >
            {COURSE_CHECKLIST.hide}
          </button>
        </span>
      </div>
      <p className={styles.lead}>{t(COURSE_CHECKLIST.lead)}</p>
      <ol className={styles.items}>
        {items.map((item) => (
          <li key={item.id} className={`${styles.item} ${item.done ? styles.done : ""}`} data-check={item.id}>
            <span className={styles.mark} aria-hidden>
              {item.done ? "✓" : ""}
            </span>
            <span className={styles.itemTitle}>
              {t(item.title)}
              {item.done && <span className={styles.srOnly}>، {COURSE_CHECKLIST.done}</span>}
            </span>
            <p className={styles.itemNote}>{t(item.note)}</p>
            {!item.done && (
              <button type="button" className={styles.itemBtn} onClick={(e) => requestTour({ ...item.tour, from: e.currentTarget })}>
                {COURSE_CHECKLIST.showMe}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function CourseHelp({ guide }: { guide: CourseGuideProps }) {
  const pathname = usePathname();
  const router = useRouter();
  const { host: where, gender, pages, titles, preview, labels } = guide;
  const host: HelpHost<GuideTarget, CoursePageId> = useMemo(() => {
    const here = coursePageFor(where, pathname);
    return {
      gender,
      path: pathname,
      ...(preview ? { preview } : {}),
      here,
      page: here ? (pages[here] ?? null) : null,
      helpOf: (p) => pages[p] ?? null,
      facts: FACTS,
      title: (p) => titles[p] ?? "",
      hrefOf: courseHrefOf,
      go: (href) => router.push(href),
      // the supervisor's «تفعيل الآن»: to the card with the switch, never switching it on by itself
      enable: async (feature) => {
        if (!feature.startsWith("card.")) return { error: "unavailable" };
        router.push(`/settings?card=${encodeURIComponent(feature.slice(5))}`);
        return {};
      },
      cityHref: "/settings",
      texts: HELP_UI,
      offers: FEATURE_OFFER,
      labels: { ...PRESS_LABELS, ...(labels as Partial<Record<GuideTarget, string | { plain: string }>>) },
    };
  }, [where, gender, pages, titles, preview, labels, pathname, router]);
  return <HelpUI host={host} />;
}
