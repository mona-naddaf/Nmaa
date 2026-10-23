import { rafiqEnabled } from "@/lib/rafiq/enabled";

// The in-site guidance for «رفيق الحفظ» (setup questions, «الخطوات الأولى»,
// help on each page, welcome and intro lines) is switched on per environment
// (ONBOARDING_ENABLED=1), on top of «رفيق الحفظ», so it can be built step by
// step without showing up on the live site. While off: nothing of it renders
// (no provider, no targets, no hidden fields), signing up doesn't mark the
// account as new, every guide action refuses and nothing is read from the
// database. No DB and no server-only imports, so the proxy can use it.
export function guideEnabled(): boolean {
  return rafiqEnabled() && process.env.ONBOARDING_ENABLED === "1";
}
