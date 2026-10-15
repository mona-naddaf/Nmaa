"use client";

import type { ReactNode } from "react";
import { SimilarProvider } from "@/components/quran/Similar";
import { rafiqSimilarSurahAction, rafiqSimilarVersesAction } from "./similar-actions";

/** «المتشابهات» marks in the verses inside, for a «رفيق الحفظ» user (her setting on); similar verses link to their verse page. */
export function SimilarScope({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <SimilarProvider loadSurah={rafiqSimilarSurahAction} loadVerses={rafiqSimilarVersesAction} links>
      {children}
    </SimilarProvider>
  );
}
