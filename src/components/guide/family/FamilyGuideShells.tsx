"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { GuideTargets } from "@/components/guide/targets";
import { focusables } from "@/components/guide/focus";
import { trackSave } from "@/components/leave-guard/LeaveGuard";
import { genderText } from "@/lib/guide/help/text";
import { GOT_IT } from "@/lib/guide/lines-texts";
import type { ChildGuidePage } from "@/lib/guide/family-keys";
import type { EnableFeature } from "@/lib/guide/help/types";
import type { PersonGender } from "@/lib/text/gender";
import { childPageFor, familyPageFor } from "@/lib/guide/help/family/pages";
import type { ChildGuideProps, AdultChildGuideProps, FamilyPagesGuideProps } from "@/lib/family/guide-pages";
import { markChildWelcomeAction } from "@/app/family/guide-actions";
import { enableChildFeatureAction } from "@/app/rafiq/(app)/family/guide-actions";
import styles from "@/app/rafiq/(app)/guide/lines.module.css";
import { FamilyHelp } from "./FamilyHelp";

// The three places «العائلة»'s guide is mounted, each by its layout and only
// where FAMILY_GUIDE_EMAILS reaches the family: the names «أرِني» lights up
// (GuideTargets), the help button, and on the child's own pages her welcome
// lines (a child added while the guide reached her family).

const WELCOME_OF: Record<string, ChildGuidePage> = {
  "c.home": "home",
  "c.plan": "plan",
  "c.tracker": "tracker",
  "c.summary": "summary",
  "c.homelog": "homelog",
  "c.segment": "segment",
  "c.family": "family",
  "c.calendar": "calendar",
};

/** The child herself (/family). */
export function ChildGuideShell({ guide, children }: { guide: ChildGuideProps; children: React.ReactNode }) {
  const pathname = usePathname();
  const here = childPageFor(pathname);
  const id = here ? WELCOME_OF[here] : undefined;
  return (
    <GuideTargets on>
      {id && guide.welcome[id] && <ChildWelcomeLine key={id} id={id} text={guide.welcome[id]!} gender={guide.gender} />}
      {children}
      <FamilyHelp where={CHILD} gender={guide.gender} pages={guide.pages} titles={guide.titles} facts={guide.facts} preview={guide.preview} />
    </GuideTargets>
  );
}

const CHILD = { kind: "child" } as const;

/** A page's welcome line with «فهمت»: hidden at once, saved in the background (back on a failure). */
function ChildWelcomeLine({ id, text, gender }: { id: ChildGuidePage; text: string; gender: PersonGender }) {
  const box = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (hidden) return null;

  async function dismiss() {
    const after = box.current ? focusables(document.body).find((el) => box.current!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !box.current!.contains(el)) : null;
    setError(null);
    setHidden(true);
    after?.focus({ preventScroll: true });
    const r = await trackSave(markChildWelcomeAction(`child.welcome.${id}`)).catch(() => ({ error: "تعذّر الحفظ، يُرجى المحاولة مرة أخرى" }));
    if (r.error) {
      setHidden(false);
      setError(r.error);
    }
  }

  return (
    <div ref={box} className={styles.line}>
      <p className={styles.lineText}>{genderText(text, gender)}</p>
      <div className={styles.lineActions}>
        <button type="button" className={styles.btn} onClick={dismiss}>
          {GOT_IT}
        </button>
      </div>
      {error && (
        <p className={styles.fail} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** An adult on one child's pages (/rafiq/family/{f}/child/{c}). */
export function AdultChildGuideShell({ guide, children }: { guide: AdultChildGuideProps; children: React.ReactNode }) {
  const { childId, canEdit } = guide;
  const enable = useCallback((feature: EnableFeature) => enableChildFeatureAction(childId, feature), [childId]);
  const where = useMemo(() => ({ kind: "adult" as const, base: guide.base }), [guide.base]);
  return (
    <GuideTargets on>
      {children}
      <FamilyHelp
        where={where}
        gender={guide.gender}
        pages={guide.pages}
        titles={guide.titles}
        facts={guide.facts}
        preview={guide.preview}
        settingsLabel={guide.settingsLabel}
        {...(canEdit ? { enable, enabledText: guide.enabledText } : {})}
      />
    </GuideTargets>
  );
}

/** An adult's own family pages: «عائلاتي», creating and joining, a family's page and its calendar. */
export function FamilyPagesGuideShell({ guide, children }: { guide: FamilyPagesGuideProps; children: React.ReactNode }) {
  const pathname = usePathname();
  const at = familyPageFor(pathname);
  // names only on the pages it reaches (a child's pages bring their own)
  const named = !!at && (at.familyId === null || Object.hasOwn(guide.families, at.familyId));
  const where = useMemo(() => ({ kind: "family" as const, families: guide.families, list: guide.list }), [guide.families, guide.list]);
  return (
    // elsewhere as the Rafiq provider names them (the founder step's card only)
    <GuideTargets on={named ? true : "family"}>
      {children}
      <FamilyHelp where={where} gender={guide.gender} titles={guide.titles} facts={FAMILY_FACTS} preview={guide.preview} />
    </GuideTargets>
  );
}

// nothing on these pages depends on a switch
const FAMILY_FACTS = { features: { agenda: false, summary: false, similar: false, tajweed: false, review: false }, city: false, plan: true, founder: false };
