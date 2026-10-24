"use client";

import { createContext, useCallback, useContext } from "react";
import { targetAttr, type GuideTarget } from "@/lib/guide/help/targets";

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

/** `{...t("record.save")}` on an element: data-guide while on, nothing at all otherwise. */
export function useGuideTarget(): (name: GuideTarget) => { "data-guide": GuideTarget } | undefined {
  const on = useContext(On);
  return useCallback((name: GuideTarget) => targetAttr(name, on === true || (on === "family" && name === "family.card")), [on]);
}
