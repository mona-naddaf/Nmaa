"use client";

import type { ReactNode } from "react";
import { SimilarProvider } from "@/components/quran/Similar";
import { staffSimilarSurahAction, staffSimilarVersesAction } from "./similar-actions";

/** «المتشابهات» marks in the verses inside, for teachers and the supervisor (course setting on). */
export function SimilarScope({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <SimilarProvider loadSurah={staffSimilarSurahAction} loadVerses={staffSimilarVersesAction}>
      {children}
    </SimilarProvider>
  );
}
