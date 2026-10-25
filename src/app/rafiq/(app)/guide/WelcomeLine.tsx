"use client";

import { useRef, useState } from "react";
import { focusables } from "@/components/guide/focus";
import { genderText } from "@/lib/guide/help/text";
import type { WelcomeId } from "@/lib/guide/keys";
import { GOT_IT, WELCOME } from "@/lib/guide/lines-texts";
import { useGuide } from "../GuideProvider";
import styles from "./lines.module.css";

// A page's welcome line on her first visit (a new account, or anyone after
// «إظهار الإرشادات من جديد»), with «فهمت». The provider shows it above the
// page; «خطتي» passes which of its lines (id). After «فهمت» the focus moves
// on to what follows it on the page, and the page's intro line may show.
export function WelcomeLine({ id }: { id?: WelcomeId }) {
  const guide = useGuide();
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = guide.decide(id ? { welcome: id } : {}).welcome;
  if (!shown) return null;

  async function dismiss() {
    // the next thing she can reach on the page, after this line
    const after = box.current ? focusables(document.body).find((el) => box.current!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !box.current!.contains(el)) : null;
    setError(null);
    const r = guide.mark(`welcome.${shown!}`);
    after?.focus({ preventScroll: true });
    const { error } = await r;
    if (error) setError(error);
  }

  return (
    <div ref={box} className={styles.line}>
      <p className={styles.lineText}>{genderText(WELCOME[shown], guide.gender)}</p>
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
