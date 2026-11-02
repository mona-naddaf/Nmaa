import { parseAllowList } from "@/lib/excuse/enabled";
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

/**
 * GUIDE_PREVIEW_EMAILS: who sees the guide's work in progress (emails, or «*»
 * for everyone; unset or empty: nobody). It's the excuse guide's own gate,
 * because EXCUSE_ALLOW_EMAILS is already «*» on the live site.
 */
export function guidePreviewAllowed(email: string | null | undefined): boolean {
  const list = parseAllowList(process.env.GUIDE_PREVIEW_EMAILS);
  if (!list) return false;
  if (list.has("*")) return true;
  return !!email && list.has(email.trim().toLowerCase());
}
