"use client";

import { useEffect, useSyncExternalStore } from "react";

// What the help button keeps clear of: a short message at the bottom of the
// screen lifts it, a celebration hides it for a moment. A component says so
// with useHelpAvoid(); without a help button on the page nothing listens,
// and nothing changes on the page itself.

export type HelpAvoid = "lift" | "hide";

const active = new Map<symbol, HelpAvoid>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** While `on`, the help button moves up («lift») or out of sight («hide»). */
export function useHelpAvoid(on: boolean, how: HelpAvoid = "lift") {
  useEffect(() => {
    if (!on) return;
    const key = Symbol();
    active.set(key, how);
    emit();
    return () => {
      active.delete(key);
      emit();
    };
  }, [on, how]);
}

function current(): HelpAvoid | null {
  let lift = false;
  for (const how of active.values()) {
    if (how === "hide") return "hide";
    lift = true;
  }
  return lift ? "lift" : null;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** For the help button: what it has to keep clear of now. */
export function useHelpAvoidState(): HelpAvoid | null {
  return useSyncExternalStore(subscribe, current, () => null);
}
