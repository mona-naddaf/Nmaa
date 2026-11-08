import type { PressLabel } from "../run";
import type { GuideTarget } from "../targets";
import type { HelpFeature } from "../types";

// The words of the help button, its panel and the «أرِني» bubble (review
// page ٣, v17), in the page's [f|m] notation; genderText() picks her forms.
// The feature lines are the ones page ٤ gives for each feature (the one for
// «أخطاء التجويد المفصّلة», which page ٤ doesn't use, is page ٣'s general
// line). Digits are Western, like the rest of Rafiq.

export const HELP_UI = {
  button: "؟ كيف أستخدم هذه الصفحة",
  buttonShort: "؟",
  title: (page: string) => `كيف أستخدم «${page}»؟`,
  lead: "[اختاري|اختر] ما [تريدين|تريد] فعله، ثم [اضغطي|اضغط] «أرِني» لنري[كِ|ك] مكانه على الصفحة.",
  showMe: "أرِني",
  close: "إغلاق",
  // the collapsed bar on a phone, for screen readers
  expand: "عرض الخطوات",
  more: "أسئلة أخرى",
  // the bubble
  prev: "السابق",
  next: "التالي",
  done: "تمّ",
  end: "إنهاء",
  step: (n: string, text: string) => `الخطوة ${n}: ${text}`,
  pressOrNext: "[اضغطي|اضغط] عليه، أو [اضغطي|اضغط] «التالي».",
  // a button the next step depends on (run.ts nextMove "wait"): she presses it herself
  pressToGo: (what: string) => `[اضغطي|اضغط] ${what} للمتابعة`,
  // «التالي» pressed there instead
  pressFirst: (what: string) => `[اضغطي|اضغط] ${what} أولًا`,
  // a step on another page
  away: (page: string) => `هذه الخطوة في صفحة «${page}». ننتقل إليها ونكمل هناك.`,
  go: (page: string) => `الذهاب إلى «${page}»`,
  cancel: "إلغاء",
  // a feature that is off
  enableNow: "تفعيل الآن",
  noThanks: "لا، شكرًا",
  enabled: "تم التفعيل ✓ [يمكنكِ|يمكنك] إيقافها من «الإعدادات».",
  enableFailed: "تعذّر التفعيل، يُرجى المحاولة مرة أخرى.",
  // no city yet: picked from a list in the settings
  city: "[حدّدي|حدّد] [مدينتكِ|مدينتك] لتربط[ي|] البنود بأوقات الصلاة.",
  toSettings: "الذهاب إلى الإعدادات",
  // nothing there yet
  missingTitle: "هذا الجزء غير موجود بعد",
  ok: "حسنًا",
};

export const FEATURE_OFFER: Record<HelpFeature, string> = {
  review:
    "يظهر هذا القسم بعد تفعيل «تذكير المراجعة». هل [تريدين|تريد] تفعيله الآن؟ يبدأ بـ14 يومًا، و[يمكنكِ|يمكنك] تغيير العدد من «الإعدادات».",
  agenda: "يظهر هذا بعد تفعيل «الجدول اليومي». هل [تريدين|تريد] تفعيله الآن؟",
  summary: "يظهر هذا بعد تفعيل «المحصّلات». هل [تريدين|تريد] تفعيلها الآن؟",
  similar: "يظهر هذا بعد تفعيل «المتشابهات». هل [تريدين|تريد] تفعيلها الآن؟",
  tajweed: "هذا الجزء يظهر بعد تفعيل «أخطاء التجويد المفصّلة». هل [تريدين|تريد] تفعيلها الآن؟",
};

/** Review reminders turned on from a tour start at 14 days, as on the review page. */
export const REVIEW_DAYS_ON_ENABLE = 14;

/**
 * The name of each button «التالي» waits on (run.ts nextMove "wait"), as the
 * steps write it: «اضغطي «{label}» للمتابعة». A step's own «press» element
 * that isn't last, and every opener in a `via`. One that isn't listed takes
 * the text the button shows; content.test.ts checks that all are listed.
 */
export const PRESS_LABELS: Partial<Record<GuideTarget, PressLabel>> = {
  // «صفحتي» and «خطتي»
  "record.flagger": "🔖 تحديد الأخطاء على مستوى الكلمة (اختياري)",
  "mistakes.section": "🔖 كلمات تحتاج مراجعة",
  "review.section": "🔁 سور تحتاج مراجعة",
  "history.section": "سجل الجلسات",
  "plan.goal": "+ هدف للحفظ",
  // «حفظي في البيت»
  "homeLog.new": "+ مقطع جديد",
  "homeLog.active": { plain: "على بطاقة المقطع" },
  "homeLog.targets": "تعديل",
  // «جدول المتابعة»
  "tracker.menu": "⚙ البنود",
  "tracker.menu.items": "إدارة البنود",
  "tracker.menu.order": "ترتيب البنود",
  "tracker.menu.bank": "بنك الجداول",
  "tracker.newItem": "+ بند جديد",
  "tracker.itemEdit": "✎",
  "tracker.back": "→ العودة إلى الجدول",
  "tracker.publish": "نشر في بنك الجداول",
  "agenda.timeBtn": "⏱",
  // «بنك جداول المتابعة»، «التقويم»، «ملاحظاتي» and a verse's page
  "templates.card": "عرض البنود",
  "calendar.add": "+ إضافة يوم خاص",
  "calendar.grid": { plain: "على اليوم في التقويم" },
  "notes.pickVerse": "+ ملاحظة على آية",
  "notes.open": "فتح الآية ←",
  "notes.newTag": "+ وسم جديد",
  "verse.newNote": "+ ملاحظة جديدة",
  "verse.similar": "≈",
  // «الإعدادات»: opens the confirmation, never deletes by itself
  "settings.delete": "حذف حسابي",
};
