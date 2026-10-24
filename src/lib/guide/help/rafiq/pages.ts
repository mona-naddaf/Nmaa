import { GUIDE_PAGES, type GuidePage } from "../../keys";

// Where «رفيق الحفظ»'s help pages are. «عائلتي» has no help of its own; a
// tour only reaches it for the founder step of «كيف أحذف حسابي؟». Pure.

export type TourPage = GuidePage | "family";

const FIXED: Record<string, GuidePage> = {
  "/rafiq": "home",
  "/rafiq/plan": "plan",
  "/rafiq/home-log": "homelog",
  "/rafiq/tracker": "tracker",
  "/rafiq/tracker/summary": "summary",
  "/rafiq/templates": "templates",
  "/rafiq/calendar": "calendar",
  "/rafiq/notes": "notes",
  "/rafiq/settings": "settings",
};

/** The help page at this path: null where there is no help (setup questions, «العائلة», signing in…). */
export function helpPageFor(pathname: string): GuidePage | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (FIXED[path]) return FIXED[path];
  if (/^\/rafiq\/home-log\/[^/]+$/.test(path)) return "segment";
  if (/^\/rafiq\/verse\/\d+\/\d+$/.test(path)) return "verse";
  return null;
}

/**
 * The page a tour can be on: a help page, or «عائلتي» itself, which is the
 * list of her families or, with only one, that family's page (it opens
 * straight there).
 */
export function tourPageFor(pathname: string): TourPage | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/rafiq/family" || /^\/rafiq\/family\/(?!new$|join$)[^/]+$/.test(path)) return "family";
  return helpPageFor(path);
}

const HREF: Record<TourPage, string | null> = {
  ...(Object.fromEntries(Object.entries(FIXED).map(([href, page]) => [page, href])) as Record<GuidePage, string>),
  // one segment's or one verse's page: reached from a list, never linked to directly
  segment: null,
  verse: null,
  family: "/rafiq/family",
};

export const hrefOf = (page: TourPage): string | null => HREF[page];

export const isTourPage = (p: string): p is TourPage => p === "family" || (GUIDE_PAGES as readonly string[]).includes(p);

/** Each page's name, as the panel and «هذه الخطوة في صفحة «…»» say it (review page ٤). */
export const PAGE_TITLE: Record<TourPage, string> = {
  home: "صفحتي",
  plan: "خطتي",
  homelog: "حفظي في البيت",
  segment: "صفحة المقطع",
  tracker: "جدول المتابعة",
  summary: "المحصّلات",
  templates: "بنك جداول المتابعة",
  calendar: "التقويم",
  notes: "ملاحظاتي",
  verse: "صفحة الآية",
  settings: "الإعدادات",
  family: "عائلتي",
};
