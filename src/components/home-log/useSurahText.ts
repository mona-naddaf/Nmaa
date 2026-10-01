"use client";

import { useEffect, useState } from "react";

// The verified Tanzil text of one surah, from the existing public endpoint
// (/api/quran-text/[n], cached by the browser). Kept in memory per surah.
const cache = new Map<number, Promise<string[] | null>>();

function load(surah: number): Promise<string[] | null> {
  let p = cache.get(surah);
  if (!p) {
    p = fetch(`/api/quran-text/${surah}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && Array.isArray(j.ayahs) ? (j.ayahs as string[]) : null))
      .catch(() => null);
    cache.set(surah, p);
  }
  return p;
}

export function useSurahText(surah: number): string[] | null {
  const [state, setState] = useState<{ surah: number; ayahs: string[] | null } | null>(null);
  useEffect(() => {
    let alive = true;
    load(surah).then((ayahs) => alive && setState({ surah, ayahs }));
    return () => {
      alive = false;
    };
  }, [surah]);
  return state && state.surah === surah ? state.ayahs : null;
}
