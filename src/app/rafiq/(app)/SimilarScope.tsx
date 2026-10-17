"use client";

import type { ReactNode } from "react";
import { SimilarProvider } from "@/components/quran/Similar";
import { rafiqSimilarSurahAction, rafiqSimilarVersesAction } from "./similar-actions";

/**
 * «المتشابهات» marks in the verses inside, for a «رفيق الحفظ» user (her setting
 * on); similar verses link to her verse page. subjectId: «العائلة», a child's
 * page (the child's setting counts, and there are no verse-page links).
 */
export function SimilarScope({ on, subjectId, children }: { on: boolean; subjectId?: string; children: ReactNode }) {
  if (!on) return <>{children}</>;
  if (subjectId !== undefined) {
    return (
      <SimilarProvider loadSurah={(s) => rafiqSimilarSurahAction(s, subjectId)} loadVerses={(k) => rafiqSimilarVersesAction(k, subjectId)}>
        {children}
      </SimilarProvider>
    );
  }
  return (
    <SimilarProvider loadSurah={rafiqSimilarSurahAction} loadVerses={rafiqSimilarVersesAction} links>
      {children}
    </SimilarProvider>
  );
}
