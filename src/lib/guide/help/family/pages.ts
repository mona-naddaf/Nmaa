import type { FamilyPageId } from "./types";

// Where «العائلة»'s help pages are, for each of its three hosts. Pure.

const trim = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);

/** The child's own pages (/family). */
export function childPageFor(pathname: string): FamilyPageId | null {
  const path = trim(pathname);
  switch (path) {
    case "/family":
      return "c.home";
    case "/family/plan":
      return "c.plan";
    case "/family/tracker":
      return "c.tracker";
    case "/family/tracker/summary":
      return "c.summary";
    case "/family/home-log":
      return "c.homelog";
    case "/family/family":
      return "c.family";
    case "/family/calendar":
      return "c.calendar";
  }
  return /^\/family\/home-log\/[^/]+$/.test(path) ? "c.segment" : null;
}

const CHILD_HREF: Partial<Record<FamilyPageId, string>> = {
  "c.home": "/family",
  "c.plan": "/family/plan",
  "c.tracker": "/family/tracker",
  "c.summary": "/family/tracker/summary",
  "c.homelog": "/family/home-log",
  "c.family": "/family/family",
  "c.calendar": "/family/calendar",
};

export const childHrefOf = (page: FamilyPageId): string | null => CHILD_HREF[page] ?? null;

const ADULT_SUFFIX: Partial<Record<FamilyPageId, string>> = {
  "a.home": "",
  "a.tracker": "/tracker",
  "a.summary": "/tracker/summary",
  "a.homelog": "/home-log",
  "a.plan": "/plan",
  "a.settings": "/settings",
};

/** One child's pages as an adult sees them, under `base` (/rafiq/family/{f}/child/{c}). */
export function adultChildPageFor(pathname: string, base: string): FamilyPageId | null {
  const path = trim(pathname);
  if (path !== base && !path.startsWith(`${base}/`)) return null;
  const rest = path.slice(base.length);
  for (const [page, suffix] of Object.entries(ADULT_SUFFIX)) if (rest === suffix) return page as FamilyPageId;
  return /^\/home-log\/[^/]+$/.test(rest) ? "a.segment" : null;
}

export const adultChildHrefOf = (page: FamilyPageId, base: string): string | null => {
  const suffix = ADULT_SUFFIX[page];
  return suffix === undefined ? null : base + suffix;
};

/** An adult's own family pages: the page, and the family it belongs to. */
export function familyPageFor(pathname: string): { page: FamilyPageId; familyId: string | null } | null {
  const path = trim(pathname);
  if (path === "/rafiq/family") return { page: "f.list", familyId: null };
  if (path === "/rafiq/family/new") return { page: "f.new", familyId: null };
  if (path === "/rafiq/family/join") return { page: "f.join", familyId: null };
  const cal = path.match(/^\/rafiq\/family\/([^/]+)\/calendar$/);
  if (cal) return { page: "f.calendar", familyId: cal[1] };
  const fam = path.match(/^\/rafiq\/family\/([^/]+)$/);
  if (fam) return { page: "f.family", familyId: fam[1] };
  return null;
}

export const familyHrefOf = (page: FamilyPageId, familyId: string | null): string | null => {
  switch (page) {
    case "f.list":
      return "/rafiq/family?list=1";
    case "f.new":
      return "/rafiq/family/new";
    case "f.join":
      return "/rafiq/family/join";
    case "f.family":
      return familyId ? `/rafiq/family/${familyId}` : null;
    case "f.calendar":
      return familyId ? `/rafiq/family/${familyId}/calendar` : null;
    default:
      return null;
  }
};

/** Each page's name, as «هذه الخطوة في صفحة «…»» says it (filled per child where it has her name). */
export const FAMILY_PAGE_TITLE: Record<FamilyPageId, string> = {
  "c.home": "صفحتي",
  "c.plan": "خطتي",
  "c.tracker": "جدول المتابعة",
  "c.summary": "المحصّلات",
  "c.homelog": "حفظي في البيت",
  "c.segment": "صفحة المقطع",
  "c.family": "عائلتي",
  "c.calendar": "التقويم",
  "a.home": "<صفحتها|صفحته>",
  "a.tracker": "جدول المتابعة",
  "a.summary": "المحصّلات",
  "a.homelog": "<حفظها|حفظه> في البيت",
  "a.segment": "صفحة المقطع",
  "a.plan": "<خطتها|خطته>",
  "a.settings": "إعدادات {name}",
  "f.list": "عائلاتي",
  "f.new": "إنشاء عائلة",
  "f.join": "الانضمام إلى عائلة",
  "f.family": "عائلتي",
  "f.calendar": "تقويم العائلة",
};
