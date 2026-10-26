// The elements «أرِني» can light up, by name (data-guide="…"). The names are
// the review page's monospace names (v17, section ٤), plus a few the engine
// needs that no text shows: «عائلتي»'s card for the founder step, and the
// limit messages that stand in for a step («إن ظهرت رسالة الحدّ»). A name
// that isn't listed here can't be used by a content file or put on the page.

export const GUIDE_TARGETS = [
  // «صفحتي»
  "home.position",
  "home.stats",
  "home.bars",
  "home.streak",
  "home.commitLink",
  "record.section",
  "record.type",
  "record.range",
  "record.day",
  "record.flagger",
  "record.noteMarker",
  "record.reason",
  "record.save",
  "mistakes.section",
  "review.section",
  "history.section",
  // «خطتي»
  "plan.templates",
  "plan.discard",
  "plan.list",
  "plan.addSelect",
  "plan.addBtn",
  "plan.save",
  "plan.prior",
  "plan.goal",
  // «حفظي في البيت» and a segment's page
  "homeLog.new",
  "homeLog.limit",
  "homeLog.active",
  "homeLog.targets",
  "homeLog.past",
  "practice.counters",
  "practice.ayat",
  "practice.text",
  "practice.finish",
  "practice.delete",
  "practice.back",
  // «جدول المتابعة» and «المحصّلات»
  "tracker.menu",
  "tracker.menu.items",
  "tracker.menu.order",
  "tracker.menu.bank",
  "tracker.newItem",
  "tracker.limit",
  "tracker.itemRow",
  "tracker.sheet",
  "tracker.summary",
  "tracker.back",
  "tracker.publish",
  "agenda.timeBtn",
  "summary.periods",
  "summary.nav",
  "summary.ring",
  "summary.mosaic",
  "summary.items",
  "summary.stats",
  "summary.back",
  // «بنك جداول المتابعة»
  "templates.card",
  "templates.search",
  "templates.own",
  // «التقويم»
  "calendar.add",
  "calendar.grid",
  "calendar.dayItem",
  "calendar.optional",
  "calendar.upcoming",
  "calendar.nav",
  // «ملاحظاتي» and a verse's page
  "notes.pickVerse",
  "notes.open",
  "notes.tags",
  "notes.search",
  "notes.newTag",
  "notes.tagRow",
  "verse.newNote",
  "verse.noteRow",
  "verse.similar",
  "verse.nav",
  // «الإعدادات»
  "settings.features",
  "settings.commit",
  "settings.review",
  "settings.city",
  "settings.restart",
  "settings.profile",
  "settings.password",
  "settings.recovery",
  "settings.devices",
  "settings.delete",
  // the «عائلتي» tab, and the card of a family she founded (the founder step)
  "nav.family",
  "family.card",
] as const;

export type GuideTarget = (typeof GUIDE_TARGETS)[number];

const KNOWN = new Set<string>(GUIDE_TARGETS);

export const isGuideTarget = (name: string): name is GuideTarget => KNOWN.has(name);

/** The attribute for an element «أرِني» can light up: nothing at all while the guidance is off. */
export function targetAttr(name: GuideTarget, on: boolean): { "data-guide": GuideTarget } | undefined {
  return on ? { "data-guide": name } : undefined;
}
