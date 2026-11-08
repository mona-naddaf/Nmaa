"use client";

import { useSyncExternalStore } from "react";

// «صفحة المصحف» or «نص كبير», remembered per device (localStorage), the same
// for every switch on the screen. The default (nothing saved, or storage
// blocked) is the Mushaf page.

export type MushafView = "page" | "text";

const KEY = "namaa.mushafView";
const listeners = new Set<() => void>();
// the choice when storage is blocked: kept until the page is left
let memory: MushafView | null = null;

function read(): MushafView {
  try {
    return localStorage.getItem(KEY) === "text" ? "text" : "page";
  } catch {
    return "page";
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function setMushafView(view: MushafView) {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    memory = view;
  }
  listeners.forEach((fn) => fn());
}

export function useMushafView(): MushafView {
  return useSyncExternalStore(
    subscribe,
    () => memory ?? read(),
    () => "page",
  );
}
