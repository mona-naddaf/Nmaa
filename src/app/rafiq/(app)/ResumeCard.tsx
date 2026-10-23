"use client";

import { useState } from "react";
import Link from "next/link";
import hl from "@/components/home-log/home-log.module.css";
import { startTexts } from "@/lib/guide/start-texts";
import type { PersonGender } from "@/lib/text/gender";
import { useGuide } from "./GuideProvider";

// «صفحتي» while the setup questions aren't finished (after «إكمال الأسئلة
// لاحقًا», a «العائلة» signup, or a re-run): how many are left, with
// «إكمال الأسئلة» and «إخفاء». later: she just came from «إكمال الأسئلة
// لاحقًا», so the line saying her answers were kept comes first.
export function ResumeCard({ gender, later }: { gender: PersonGender; later: boolean }) {
  const t = startTexts(gender);
  const guide = useGuide();
  const [error, setError] = useState<string | null>(null);
  const card = guide.decide({ page: "home" }).wizard.card;
  if (!card) return null;

  return (
    <div className={hl.section}>
      {later && (
        <p className={hl.ok} role="status" style={{ marginTop: 0 }}>
          {t.laterNote}
        </p>
      )}
      <p style={{ margin: "0 0 10px", fontSize: 14 }}>{t.card.line(card.remaining)}</p>
      {error && (
        <p className={hl.err} role="alert">
          {error}
        </p>
      )}
      <div className={hl.actionsRow}>
        <Link href="/rafiq/start" className={hl.primaryBtn} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
          {t.card.resume}
        </Link>
        <button
          type="button"
          className={hl.ghostBtn}
          onClick={async () => {
            setError(null);
            const r = await guide.mark("wizard.cardHidden");
            if (r.error) setError(r.error);
          }}
        >
          {t.card.hide}
        </button>
      </div>
    </div>
  );
}
