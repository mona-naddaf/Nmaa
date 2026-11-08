import { parseAllowList } from "@/lib/excuse/enabled";

// «صفحة المصحف» (the verses in the Madinah Mushaf's page layout) in «رفيق
// الحفظ» and «العائلة», while it's tried out: only the accounts listed in
// MUSHAF_VIEW_EMAILS (emails, or «*» for everyone; unset or empty: nobody).
// On a child's pages the adult's email decides. Courses never get it.
//
// The server passes the result down as the `mushaf` prop; without it every
// component renders exactly as before. No DB and no server-only imports.

/** What the Mushaf view needs in the browser. */
export interface MushafConfig {
  /** where the QCF V2 page fonts are served: `${fontBase}/p{n}.woff2` */
  fontBase: string;
}

/** The Quran Foundation CDN (QCF V2, woff2), unless MUSHAF_FONT_BASE moves them to our own storage. */
export const DEFAULT_FONT_BASE = "https://verses.quran.foundation/fonts/quran/hafs/v2/woff2";

export function mushafViewFor(email: string | null | undefined): MushafConfig | undefined {
  const list = parseAllowList(process.env.MUSHAF_VIEW_EMAILS);
  if (!list) return undefined;
  if (!list.has("*") && !(email && list.has(email.trim().toLowerCase()))) return undefined;
  const base = process.env.MUSHAF_FONT_BASE?.trim().replace(/\/+$/, "");
  return { fontBase: base || DEFAULT_FONT_BASE };
}
