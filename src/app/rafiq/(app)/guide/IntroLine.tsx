"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { focusables } from "@/components/guide/focus";
import { genderText } from "@/lib/guide/help/text";
import type { IntroId } from "@/lib/guide/keys";
import { INTRO_FEATURE } from "@/lib/guide/lines";
import { INTRO, INTRO_UI } from "@/lib/guide/lines-texts";
import { useGuide } from "../GuideProvider";
import { enableFeature } from "./enable";
import styles from "./lines.module.css";

// A feature's intro line (review page ٥), in the place the feature shows.
// candidates: every intro line whose condition holds on this page now (in
// introsFor's order), so that one line at most shows on the page and none
// while its welcome line is up; here: the ones this place shows. «تفعيل»
// switches the feature on at her press (the line goes at once and comes back
// with a message if that fails); «×» and the links («تحديد المدينة»، «وضع
// هدف») dismiss it for good, as does «فهمت» on the notes tip.

// where a line's button goes, when it isn't «تفعيل»
const HREF: Partial<Record<IntroId, string>> = { city: "/rafiq/settings#city", goal: "/rafiq/plan?to=goal" };

export function IntroLine({ candidates, here }: { candidates: IntroId[]; here: IntroId[] }) {
  const guide = useGuide();
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const [busy, setBusy] = useState<IntroId | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState<{ id: IntroId; text: string } | null>(null);
  const t = (s: string) => genderText(s, guide.gender);
  const id = guide.decide({ intros: candidates }).intro;
  useEffect(() => {
    if (enabled) noteRef.current?.focus({ preventScroll: true });
  }, [enabled]);

  // switched on here: the line's place says so for the rest of the visit
  if (enabled) {
    return (
      <div className={`${styles.line} ${styles.intro}`} role="status">
        <p ref={noteRef} tabIndex={-1} className={styles.lineText}>
          {t(INTRO_UI.enabled)}
        </p>
      </div>
    );
  }
  if (!id || !here.includes(id) || busy === id) return null;
  const line = INTRO[id];
  const feature = INTRO_FEATURE[id];

  // the next thing she can reach after the line, for the focus when it goes
  const after = () =>
    box.current ? (focusables(document.body).find((el) => box.current!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !box.current!.contains(el)) ?? null) : null;

  async function dismiss(failText?: string) {
    const next = after();
    setFailed(null);
    const r = guide.mark(`intro.${id!}`);
    next?.focus({ preventScroll: true });
    const { error } = await r;
    if (error) setFailed({ id: id!, text: failText ?? error });
  }

  async function press() {
    setFailed(null);
    if (!feature) {
      const href = HREF[id!];
      void dismiss();
      if (href) router.push(href);
      return;
    }
    setBusy(id);
    const r = await enableFeature(feature).catch(() => ({ error: "failed" }));
    if (r.error) {
      setBusy(null);
      setFailed({ id: id!, text: INTRO_UI.failed });
      return;
    }
    setEnabled(true);
    setBusy(null);
    void guide.mark(`intro.${id!}`);
    router.refresh();
  }

  return (
    <div ref={box} className={`${styles.line} ${styles.intro}`} role="status">
      <p className={styles.lineText}>{t(line.text)}</p>
      <div className={styles.lineActions}>
        <button type="button" className={styles.btn} onClick={press}>
          {line.button}
        </button>
        {line.close && (
          <button type="button" className={styles.close} aria-label={INTRO_UI.closeLabel} onClick={() => dismiss()}>
            ×
          </button>
        )}
      </div>
      {failed?.id === id && (
        <p className={styles.fail} role="alert">
          {failed.text}
        </p>
      )}
    </div>
  );
}
