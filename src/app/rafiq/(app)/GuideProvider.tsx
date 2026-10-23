"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { trackSave } from "@/components/leave-guard/LeaveGuard";
import type { GuideKey, GuideValue } from "@/lib/guide/keys";
import { decideGuide, resetFor, type GuideDecision, type GuideInput, type GuideReset, type GuideStates } from "@/lib/guide/rules";
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
  // what she marked on these pages: a server snapshot can be older than such a
  // save (a link prefetched while it was on its way), so it never takes them back;
  // only a reset (through this provider) removes them
  const [mine, setMine] = useState<GuideStates>({});
  // a fresh server snapshot (a new render of the layout) replaces the local one
  const [seen, setSeen] = useState(snapshot);
  if (seen !== snapshot) {
    setSeen(snapshot);
    setStates({ ...snapshot.states, ...mine });
  }

  const mark = useCallback(
    async (key: GuideKey, value: GuideValue = null) => {
      // only this key goes back on a failure, so other changes made meanwhile stay
      const had = Object.hasOwn(states, key);
      const prev = states[key] ?? null;
      const hadMine = Object.hasOwn(mine, key);
      const prevMine = mine[key] ?? null;
      setStates((s) => ({ ...s, [key]: value }));
      setMine((m) => ({ ...m, [key]: value }));
      const r = await trackSave(markGuideAction(key, value)).catch(() => ({ error: "تعذّر الحفظ، يُرجى المحاولة مرة أخرى" }));
      if (r.error) {
        const putBack = (was: boolean, before: GuideValue) => (s: GuideStates) => {
          const next = { ...s };
          if (was) next[key] = before;
          else delete next[key];
          return next;
        };
        setStates(putBack(had, prev));
        setMine(putBack(hadMine, prevMine));
      }
      return r;
    },
    [states, mine],
  );

  const reset = useCallback(async (kind: GuideReset) => {
    const r = await trackSave(resetGuideAction(kind)).catch(() => ({ error: "تعذّر الحفظ، يُرجى المحاولة مرة أخرى", states: undefined }));
    if (r.states) {
      const gone = new Set<string>(resetFor(kind).remove);
      setMine((m) => Object.fromEntries(Object.entries(m).filter(([k]) => !gone.has(k))));
      setStates(r.states);
    }
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
