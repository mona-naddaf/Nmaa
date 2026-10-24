"use client";

import { createContext, useCallback, useContext } from "react";
import type { GuideTarget } from "@/lib/guide/help/targets";

// Names on the elements «أرِني» can light up (src/lib/guide/help/targets.ts).
// Only inside <GuideTargets on>, which the guide's provider mounts while the
// guidance is on: anywhere else (guidance off, the courses' pages) the hook
// gives nothing, so the element renders exactly as before. On «العائلة»
// pages only the founder step's card is named.

type TargetsOn = boolean | "family";

const On = createContext<TargetsOn>(false);

export function GuideTargets({ on, children }: { on: TargetsOn; children: React.ReactNode }) {
  return <On.Provider value={on}>{children}</On.Provider>;
}

/**
 * `{...t("record.save")}` on an element: data-guide while on, nothing at all
 * otherwise. An element can carry more than one name (`t("templates.card",
 * "templates.own")`).
 */
export function useGuideTarget(): (...names: GuideTarget[]) => { "data-guide": string } | undefined {
  const on = useContext(On);
  return useCallback(
    (...names: GuideTarget[]) => {
      const named = on === true ? names : on === "family" ? names.filter((n) => n === "family.card") : [];
      return named.length ? { "data-guide": named.join(" ") } : undefined;
    },
    [on],
  );
}
