import { rafiqEnabled } from "@/lib/rafiq/enabled";

// «العائلة» is switched on per environment (FAMILY_ENABLED=1), on top of
// «رفيق الحفظ» (its adults are Rafiq accounts), so it can be built and merged
// step by step without showing up on the live site before it's ready. While
// off: no «عائلتي» tab, every /rafiq/family page redirects to /rafiq
// (src/proxy.ts), and every family action and page refuses. No DB and no
// server-only imports, so the proxy can use it.
export function familyEnabled(): boolean {
  return rafiqEnabled() && process.env.FAMILY_ENABLED === "1";
}
