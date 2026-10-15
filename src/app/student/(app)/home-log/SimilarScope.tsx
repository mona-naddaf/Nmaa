"use client";

import type { ReactNode } from "react";
import { SimilarProvider } from "@/components/quran/Similar";
import { studentSimilarSurahAction, studentSimilarVersesAction } from "./similar-actions";

/** «المتشابهات» marks in the verses inside, for the student in «حفظي في البيت» (course setting on). */
export function SimilarScope({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <SimilarProvider loadSurah={studentSimilarSurahAction} loadVerses={studentSimilarVersesAction}>
      {children}
    </SimilarProvider>
  );
}
