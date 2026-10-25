"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import hl from "@/components/home-log/home-log.module.css";
import { useGuideTarget } from "@/components/guide/targets";
import { genderText } from "@/lib/guide/help/text";
import { checklistComesBack } from "@/lib/guide/lines";
import { GUIDE_CARD } from "@/lib/guide/lines-texts";
import { useGuide } from "../GuideProvider";

// «أسئلة البداية» in the settings (review page ١), for every account while
// guidance is on: «إعادة أسئلة البداية» starts the setup questions again
// (nothing she recorded is touched; the plan question is a link only), and
// «إظهار الإرشادات من جديد» brings back the welcome and intro lines, and the
// checklist only where it really comes back — which its confirmation says.
// checklistComplete: her «الخطوات الأولى» are all done (a new account's).
export function GuideCard({ checklistComplete }: { checklistComplete: boolean }) {
  const guide = useGuide();
  const router = useRouter();
  const t = useGuideTarget();
  const [busy, setBusy] = useState<"wizard" | "hints" | null>(null);
  const [error, setError] = useState<{ for: "wizard" | "hints"; text: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (done) doneRef.current?.focus({ preventScroll: true });
  }, [done]);
  if (!guide.on) return null;

  async function restart() {
    if (busy) return;
    setBusy("wizard");
    setError(null);
    setDone(null);
    const r = await guide.reset("wizard");
    if (r.error) {
      setBusy(null);
      setError({ for: "wizard", text: r.error });
      return;
    }
    router.push("/rafiq/start");
  }

  async function restore() {
    if (busy) return;
    // decided before the reset: whether her checklist is the hidden, unfinished one
    const back = checklistComesBack(guide.isNew, guide.states, checklistComplete);
    setBusy("hints");
    setError(null);
    setDone(null);
    const r = await guide.reset("hints");
    setBusy(null);
    if (r.error) setError({ for: "hints", text: r.error });
    else setDone(back ? GUIDE_CARD.hintsDoneWithChecklist : GUIDE_CARD.hintsDone);
  }

  return (
    <div className={hl.section}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
        {GUIDE_CARD.title}
      </div>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        {genderText(GUIDE_CARD.body, guide.gender)}
      </p>
      <div className={hl.actionsRow}>
        <button type="button" className={`${hl.ghostBtn} pressable`} aria-busy={busy === "wizard"} onClick={restart} {...t("settings.restart")}>
          {busy === "wizard" ? GUIDE_CARD.saving : GUIDE_CARD.restart}
        </button>
      </div>
      {error?.for === "wizard" && (
        <p className={hl.err} role="alert" style={{ margin: "6px 0 0" }}>
          {error.text}
        </p>
      )}
      <div className={hl.actionsRow}>
        <button type="button" className={`${hl.ghostBtn} pressable`} aria-busy={busy === "hints"} onClick={restore}>
          {busy === "hints" ? GUIDE_CARD.saving : GUIDE_CARD.hints}
        </button>
      </div>
      {error?.for === "hints" && (
        <p className={hl.err} role="alert" style={{ margin: "6px 0 0" }}>
          {error.text}
        </p>
      )}
      {done && (
        <p ref={doneRef} tabIndex={-1} className={hl.ok} role="status" style={{ margin: "8px 0 0" }}>
          {done}
        </p>
      )}
    </div>
  );
}
