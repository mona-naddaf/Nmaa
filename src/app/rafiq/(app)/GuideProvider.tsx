"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { trackSave } from "@/components/leave-guard/LeaveGuard";
import type { GuideKey, GuideValue } from "@/lib/guide/keys";
import { decideGuide, type GuideDecision, type GuideInput, type GuideReset, type GuideStates } from "@/lib/guide/rules";
import type { GuideSnapshot } from "@/lib/guide/state";
import { markGuideAction, resetGuideAction, type GuideResult } from "./guide-actions";

// Her guide state on the page (src/lib/guide), mounted by the Rafiq layout
// only while guidance is on: with it off there is no provider at all, and
// every guide piece reads «off» from useGuide(). A change shows at once and
// is saved in the background (counted by LeaveGuard while on its way); a
// failed save puts the state back and returns the message for the caller to
// show. «العائلة» pages get «off» too: the guidance doesn't cover them.

type GuideContext = {
  on: boolean;
  isNew: boolean;
  states: GuideStates;
  /** What to show here; the page passes its own facts (page id, intro lines that apply…). */
  decide: (facts: Omit<GuideInput, "on" | "kind" | "isNew" | "states">) => GuideDecision;
  mark: (key: GuideKey, value?: GuideValue) => Promise<GuideResult>;
  reset: (kind: GuideReset) => Promise<GuideResult>;
};

const OFF: GuideContext = {
  on: false,
  isNew: false,
  states: {},
  decide: (facts) => decideGuide({ ...facts, on: false, kind: "ADULT", isNew: false, states: {} }),
  mark: async () => ({}),
  reset: async () => ({}),
};

const Ctx = createContext<GuideContext>(OFF);

export function useGuide(): GuideContext {
  return useContext(Ctx);
}

export function GuideProvider({ snapshot, children }: { snapshot: GuideSnapshot; children: React.ReactNode }) {
  const pathname = usePathname();
  const [states, setStates] = useState<GuideStates>(snapshot.states);
  // a fresh server snapshot (a new render of the layout) replaces the local one
  const [seen, setSeen] = useState(snapshot);
  if (seen !== snapshot) {
    setSeen(snapshot);
    setStates(snapshot.states);
  }

  const mark = useCallback(
    async (key: GuideKey, value: GuideValue = null) => {
      // only this key goes back on a failure, so other changes made meanwhile stay
      const had = Object.hasOwn(states, key);
      const prev = states[key] ?? null;
      setStates((s) => ({ ...s, [key]: value }));
      const r = await trackSave(markGuideAction(key, value)).catch(() => ({ error: "تعذّر الحفظ، يُرجى المحاولة مرة أخرى" }));
      if (r.error) {
        setStates((s) => {
          const next = { ...s };
          if (had) next[key] = prev;
          else delete next[key];
          return next;
        });
      }
      return r;
    },
    [states],
  );

  const reset = useCallback(async (kind: GuideReset) => {
    const r = await trackSave(resetGuideAction(kind)).catch(() => ({ error: "تعذّر الحفظ، يُرجى المحاولة مرة أخرى", states: undefined }));
    if (r.states) setStates(r.states);
    return r.error ? { error: r.error } : {};
  }, []);

  const family = pathname === "/rafiq/family" || pathname.startsWith("/rafiq/family/");
  const value: GuideContext = family
    ? OFF
    : {
        on: true,
        isNew: snapshot.isNew,
        states,
        decide: (facts) => decideGuide({ ...facts, on: true, kind: "ADULT", isNew: snapshot.isNew, states }),
        mark,
        reset,
      };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
