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
  more: "أسئلة أخرى",
  // the bubble
  prev: "السابق",
  next: "التالي",
  done: "تمّ",
  end: "إنهاء",
  step: (n: string, text: string) => `الخطوة ${n}: ${text}`,
  pressOrNext: "[اضغطي|اضغط] عليه، أو [اضغطي|اضغط] «التالي».",
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
