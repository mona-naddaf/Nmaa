// The courses' page-level guide words: the line that announces «؟» to existing
// users, the welcome lines' ending and «فهمت», the supervisor's «الخطوات
// الأولى», and the lines a question shows in place of its steps. [f|m]: the
// one looking; <f|m>: the course's students; {sup}: «مشرفة الدورة» / «مشرف
// الدورة». Digits are Western. Pure.

export const COURSE_PRESS_HELP = "للشرح خطوة بخطوة [اضغطي|اضغط] «؟» أسفل الشاشة.";

export const COURSE_GOT_IT = "فهمت";

/** Existing users: once, on the first page they open; «×» hides it for good on this device. */
export const COURSE_ANNOUNCE = "جديد: زرّ «؟ كيف أستخدم هذه الصفحة» أسفل الشاشة يشرح كل صفحة خطوة بخطوة.";
export const COURSE_ANNOUNCE_CLOSE = "إخفاء";

export const COURSE_LINES = {
  // a teacher without the permission a question needs
  needsPerm: "[تحتاجين|تحتاج] صلاحية من {sup}. يمكن منحها من «صلاحيات المعلمين» في «الإعدادات».",
  // a teacher, a student or a parent: the feature is off in the course
  off: "هذه الميزة غير مفعّلة في الدورة.",
  // the supervisor: the feature is off; «تفعيل الآن» opens its card
  offer: (card: string) => `هذه الميزة غير مفعّلة في الدورة. [تجدين|تجد] مفتاحها في بطاقة «${card}» في «الإعدادات».`,
} as const;

/** The settings cards a guide link may open (?card=…), in the page's order. */
export const SETTINGS_CARDS = [
  "code",
  "board",
  "perms",
  "online",
  "progress",
  "timezone",
  "excuse",
  "review",
  "streak",
  "studentLogin",
  "similar",
  "tajweed",
  "info",
  "calendar",
  "groups",
  "points",
] as const;
export type SettingsCard = (typeof SETTINGS_CARDS)[number];
export const isSettingsCard = (raw: unknown): raw is SettingsCard => typeof raw === "string" && (SETTINGS_CARDS as readonly string[]).includes(raw);

export type CourseChecklistId = "groups" | "students" | "teachers" | "settings";

export const COURSE_CHECKLIST = {
  title: "الخطوات الأولى للدورة",
  lead: "أربع خطوات تساعد[كِ|ك] على بدء الدورة. تُعلَّم كل خطوة وحدها حين [تنجزينها|تنجزها].",
  count: (done: number, total: number) => `[أنجزتِ|أنجزتَ] ${done} من ${total}`,
  hide: "إخفاء القائمة",
  hidden: "أُخفيت القائمة. [تجدين|تجد] الشرح دائمًا في زر «؟».",
  done: "تمّ",
  showMe: "أرِني",
  celebrate: "[أحسنتِ|أحسنتَ]، [بدأتِ|بدأتَ] الدورة على مُكث 🌿",
  items: {
    groups: {
      title: "[جهّزي|جهّز] مجموعات الدورة",
      note: "[أضيفي|أضف] مجموعة أو [غيّري|غيّر] اسم «المجموعة الأولى»، [واختاري|واختر] لكل مجموعة: بنات أو بنين أو مختلطة.",
    },
    students: {
      title: "[أضيفي|أضف] أول <طالبة|طالب>",
      note: "من «+ إضافة <طالبة|طالب>» في «قائمة الطلاب»، يدويًا أو من ملف Excel.",
    },
    teachers: {
      title: "[شاركي|شارك] رمز الدورة مع المعلمين",
      note: "من «الإعدادات» ← «رمز الدورة للمعلمين». تُعلَّم الخطوة حين يدخل أول معلم.",
    },
    settings: {
      title: "[اختاري|اختر] ما تحتاجه الدورة من «الإعدادات»",
      note: "مثل دخول الطلاب، وصلاحيات المعلمين، وتذكير المراجعة. كل الميزات تبدأ غير مفعّلة.",
    },
  } satisfies Record<CourseChecklistId, { title: string; note: string }>,
};

