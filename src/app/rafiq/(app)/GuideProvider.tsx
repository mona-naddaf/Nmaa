"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { GuideTargets } from "@/components/guide/targets";
import { trackSave } from "@/components/leave-guard/LeaveGuard";
import type { GuideKey, GuidePage, GuideValue } from "@/lib/guide/keys";
import { decideGuide, resetFor, type GuideDecision, type GuideInput, type GuideReset, type GuideStates } from "@/lib/guide/rules";
import type { GuideSnapshot } from "@/lib/guide/state";
import type { HelpFacts } from "@/lib/guide/help/types";
import { helpPageFor } from "@/lib/guide/help/rafiq/pages";
import { welcomeFor } from "@/lib/guide/lines";
import type { PersonGender } from "@/lib/text/gender";
import { markGuideAction, resetGuideAction, type GuideResult } from "./guide-actions";
import { WelcomeLine } from "./guide/WelcomeLine";

// Her guide state on the page (src/lib/guide), mounted by the Rafiq layout
// only while guidance is on: with it off there is no provider at all, and
// every guide piece reads «off» from useGuide(). A change shows at once and
// is saved in the background (counted by LeaveGuard while on its way); a
// failed save puts the state back and returns the message for the caller to
// show. «العائلة» pages get «off» too: the guidance doesn't cover them.
// It also puts the names on what «أرِني» lights up (GuideTargets), shows the
// page's welcome line above it («خطتي» shows its own: which one depends on
// ?from=start), notes her first visit to «حفظي في البيت» (item 3 of «الخطوات
// الأولى»), and loads the help button with its panel and tours (./help, in
// its own chunk).

const RafiqHelp = dynamic(() => import("./help/RafiqHelp"), { ssr: false });

type GuideContext = {
  on: boolean;
  isNew: boolean;
  states: GuideStates;
  gender: PersonGender;
  facts: HelpFacts | null;
  // the guide's page here, if any
  page: GuidePage | null;
  /** What to show here; the page passes its own facts (intro lines that apply…); page and welcome line default to here's. */
  decide: (facts: Omit<GuideInput, "on" | "kind" | "isNew" | "states">) => GuideDecision;
  mark: (key: GuideKey, value?: GuideValue) => Promise<GuideResult>;
  reset: (kind: GuideReset) => Promise<GuideResult>;
};

const OFF: GuideContext = {
  on: false,
  isNew: false,
  states: {},
  gender: "FEMALE",
  facts: null,
  page: null,
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
  const page = family ? null : helpPageFor(pathname);
  // «خطتي» passes its own line (?from=start isn't known here); the rest is the page's
  const welcome = page ? welcomeFor(page, { hasPlan: snapshot.facts.plan, fromStart: false }) : undefined;

  // item 3 of «الخطوات الأولى»: her first visit to «حفظي في البيت» (once a visit, even if it fails)
  const homelogTried = useRef(false);
  const visitedHomelog = (page === "homelog" || page === "segment") && snapshot.isNew && !Object.hasOwn(states, "checklist.homelog");
  useEffect(() => {
    if (!visitedHomelog || homelogTried.current) return;
    homelogTried.current = true;
    void mark("checklist.homelog");
  }, [visitedHomelog, mark]);

  const value: GuideContext = family
    ? OFF
    : {
        on: true,
        isNew: snapshot.isNew,
        states,
        gender: snapshot.gender,
        facts: snapshot.facts,
        page,
        decide: (facts) => decideGuide({ page, welcome, ...facts, on: true, kind: "ADULT", isNew: snapshot.isNew, states }),
        mark,
        reset,
      };
  return (
    <Ctx.Provider value={value}>
      <GuideTargets on={family ? "family" : true}>
        {page && page !== "plan" && <WelcomeLine />}
        {children}
      </GuideTargets>
      <RafiqHelp gender={snapshot.gender} facts={snapshot.facts} />
    </Ctx.Provider>
  );
}
