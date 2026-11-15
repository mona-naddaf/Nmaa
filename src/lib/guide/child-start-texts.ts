import { itemsCount } from "@/lib/family/tracker-copy";

// The child's start questions and the remaining features (the family guide's
// review page, sections ١ and ٢, approved 2026-11-15), in its notation:
// [f|m] the adult answering, <f|m> and {name} the child. Filled by
// fillFamily, then genderText. Pure. Edit the texts only with Mona.

export type ChildPlanChoice = "juzamma" | "mushafrev" | "mushaf" | "custom";

export const CHILD_PLAN_OPTIONS: { key: ChildPlanChoice; template: string; label: string; desc: string; meta: string }[] = [
  { key: "juzamma", template: "JUZ_AMMA_REVERSE", label: "جزء عمّ فقط", desc: "<تبدأ|يبدأ> بسورة الناس <وتنتهي|وينتهي> بسورة النبأ. سور قصيرة، مناسبة لبداية خفيفة.", meta: "جزء عمّ بالعكس · 37 سورة" },
  { key: "mushafrev", template: "MUSHAF_REVERSE", label: "من آخر المصحف، بالسور القصيرة", desc: "<تبدأ|يبدأ> بسورة الناس ثم الفلق ثم الإخلاص، وصولًا إلى الفاتحة.", meta: "ترتيب المصحف بالعكس · 114 سورة" },
  { key: "mushaf", template: "MUSHAF_ORDER", label: "من أول المصحف", desc: "<تبدأ|يبدأ> بالفاتحة ثم البقرة، بالترتيب المعتاد حتى سورة الناس.", meta: "ترتيب المصحف · 114 سورة" },
  { key: "custom", template: "CUSTOM", label: "أختار السور بنفسي", desc: "[تختارين|تختار] السور وترتيبها كما [تشائين|تشاء]. تبقى الخطة الحالية حتى [تحفظي|تحفظ] الجديدة.", meta: "خطة مخصّصة" },
];

/** The current plan's option (a saved template's name), first and marked «الحالية». */
export function currentPlanOption(template: string | null): ChildPlanChoice | null {
  return CHILD_PLAN_OPTIONS.find((o) => o.template === template)?.key ?? null;
}

/** The options in their order, the current plan first. */
export function planOptionsFor(current: ChildPlanChoice | null) {
  if (!current) return CHILD_PLAN_OPTIONS;
  return [...CHILD_PLAN_OPTIONS.filter((o) => o.key === current), ...CHILD_PLAN_OPTIONS.filter((o) => o.key !== current)];
}

export const planLabel = (template: string | null) => CHILD_PLAN_OPTIONS.find((o) => o.template === template)?.label ?? "خطة مخصّصة";

/** «سؤال واحد» / «سؤالان» / «3 أسئلة» in S0.7. */
export function startLeftLine(n: number): string {
  if (n === 1) return "بقي سؤال واحد لتجهيز صفحة {name}.";
  if (n === 2) return "بقي سؤالان لتجهيز صفحة {name}.";
  return `بقيت ${n} أسئلة لتجهيز صفحة {name}.`;
}

// «نُسخت 6 بنود» / «نُسخ بند واحد» / «نُسخ 11 بندًا»
const copiedVerb = (n: number) => (n % 100 >= 3 && n % 100 <= 10 ? "نُسخت" : "نُسخ");

export const CHILD_START = {
  // S0: the first screen and every question's buttons
  welcome: {
    title: "تمّت إضافة {name} ✓",
    body: "أربعة أسئلة قصيرة نجهّز بها صفحة {name}، وتأخذ دقيقة تقريبًا. كل إجابة تُحفظ مباشرة، و[يمكنكِ|يمكنك] تغييرها لاحقًا.",
    skipHint: "لا [تعرفين|تعرف] الجواب؟ [اضغطي|اضغط] «تخطٍّ»، ولن يتغيّر شيء.",
    start: "لنبدأ",
  },
  next: "التالي",
  back: "السابق",
  skip: "تخطٍّ",
  later: "إكمال الأسئلة لاحقًا",
  progress: (q: number) => `السؤال ${q} من 4`,
  saving: "جارٍ الحفظ…",
  saved: "تم الحفظ ✓",
  saveError: "تعذّر الحفظ. [تحقّقي|تحقّق] من الاتصال، ثم [اضغطي|اضغط] «التالي» مرة أخرى.",
  laterNote: "حُفظت [إجاباتكِ|إجاباتك] حتى الآن. [تجدين|تجد] بقية الأسئلة في صفحة {name}.",
  card: { more: "إكمال الأسئلة", hide: "إخفاء" },

  q1: {
    title: "من أين <تبدأ|يبدأ> {name} <حفظها|حفظه>؟",
    intro: (plan: string) => `<خطتها|خطته> الآن «${plan}». [أبقيها|أبقِها] إن كانت مناسبة، أو [اختاري|اختر] غيرها. [يمكنكِ|يمكنك] تغييرها لاحقًا من «<خطتها|خطته>» دون أن يضيع شيء.`,
    current: "الحالية",
    customNote: "ستُفتح صفحة «<خطتها|خطته>» في نهاية الأسئلة [لتختاري|لتختار] السور.",
    skipped: (plan: string) => `لا بأس. تبقى <خطتها|خطته> «${plan}».`,
  },
  q2: {
    title: "هل <حفظت|حفظ> {name} شيئًا من القرآن من قبل؟",
    intro: "إن <كانت|كان> {name} <تحفظ|يحفظ> سورًا من قبل، [أضيفيها|أضفها] هنا ليعرف الموقع أين <وصلت|وصل>.",
    yes: "نعم، <حفظت|حفظ> سورًا من قبل",
    no: "لا، <تبدأ|يبدأ> من البداية",
    afterYes: "[اختاري|اختر] كل سورة <تحفظها|يحفظها> كاملة. وإن <كانت|كان> <تحفظ|يحفظ> جزءًا من سورة، [حدّدي|حدّد] الآيات. ثم [اضغطي|اضغط] «التالي».",
    empty: "لم [تختاري|تختر] أي سورة بعد. [اختاري|اختر] سورة، أو [اضغطي|اضغط] «لا، <تبدأ|يبدأ> من البداية».",
    saved: "تمّت إضافة الحفظ السابق ✓ [يمكنكِ|يمكنك] إضافة المزيد لاحقًا من «<خطتها|خطته>».",
    missing: "لم [تختاري|تختر] جوابًا بعد. [اختاري|اختر] «نعم، <حفظت|حفظ> سورًا من قبل» أو «لا، <تبدأ|يبدأ> من البداية».",
  },
  q3: {
    title: "كيف يبدأ جدول متابعة {name}؟",
    intro: "جدول المتابعة قائمة بأعمال {name} اليومية، مثل: ورد المراجعة، وأذكار الصباح. كل عمل فيه اسمه «بند»، <تضع|يضع> عليه ✓ حين <تنجزه|ينجزه>.",
    bank: "من بنك الجداول",
    bankDesc: "جداول شاركها [غيركِ|غيرك]. تظهر المقترحة أولًا، ولكل جدول زرّ «عرض البنود».",
    copy: "نسخ جدول موجود",
    copyDesc: "بنود [جدولكِ|جدولك]، أو جدول أحد <إخوتها|إخوته>.",
    empty: "جدول فارغ",
    emptyDesc: "[تضيفين|تضيف] البنود لاحقًا من «جدول المتابعة» في صفحة {name}.",
    note: "البنود التي [تضيفينها|تضيفها] <تضع|يضع> عليها {name} ✓، ولا <تغيّرها|يغيّرها>. <وتستطيع|ويستطيع> أن <تضيف|يضيف> بنودًا <بنفسها|بنفسه> أيضًا.",
    show: "عرض البنود",
    hide: "إخفاء البنود",
    choose: "اختيار هذا الجدول",
    chosen: "✓ تم الاختيار",
    suggested: "مقترح",
    mine: "جدولي",
    copyNote: "تُنسخ البنود الحالية فقط، وبعد النسخ يصبح كل بند مستقلًّا.",
    added: (n: number) => (n > 0 ? `تمّت إضافة ${itemsCount(n)} إلى جدول {name} ✓` : "كل بنود هذا الجدول موجودة في جدول {name}."),
    copied: (n: number) => `${copiedVerb(n)} ${itemsCount(n)} إلى جدول {name} ✓`,
    already: (n: number) => `في جدول {name} الآن ${itemsCount(n)}. ما [تضيفينه|تضيفه] هنا يُضاف إليها، ولا يُضاف بند موجود بالاسم نفسه.`,
    missing: "لم [تختاري|تختر] جوابًا بعد. [اختاري|اختر] «من بنك الجداول» أو «نسخ جدول موجود» أو «جدول فارغ».",
    noBank: "لم [تختاري|تختر] جدولًا بعد. [اختاري|اختر] جدولًا، أو [اختاري|اختر] «جدول فارغ».",
    noCopy: "لم [تختاري|تختر] الجدول الذي [تنسخينه|تنسخه] بعد. [اختاري|اختر] جدولًا، أو [اختاري|اختر] «جدول فارغ».",
  },
  q4: {
    title: "ما الميزات التي [تريدين|تريد] أن [تُفعّليها|تُفعّلها] لـ{name}؟",
    intro: "[ضعي|ضع] علامة على ما <يناسبها|يناسبه>. [يمكنكِ|يمكنك] تغيير ذلك متى [شئتِ|شئتَ] من «إعدادات {name}».",
    noCity: "الأوقات المرتبطة بالصلاة تحتاج مدينة العائلة، وتُحدَّد في «عائلتي».",
    alreadyOn: "هذه الميزة مفعّلة الآن، ويمكن إيقافها من «إعدادات {name}».",
  },
  done: {
    title: "[جهّزتِ|جهّزتَ] حساب {name} ✓",
    plan: (label: string) => `الخطة: ${label} ✓`,
    prior: (n: number) => `الحفظ السابق: ${surahsCount(n)} ✓`,
    tracker: (n: number) => `جدول المتابعة: ${itemsCount(n)} ✓`,
    features: (names: string[]) => `الميزات: ${names.join("، ")} ✓`,
    others: "وفي «إعدادات {name}» ميزات أخرى، مثل المتشابهات والتظليل.",
    code: (code: string) => `<تدخل|يدخل> {name} من بطاقة «العائلة» في الصفحة الرئيسية <باسمها ورمزها|باسمه ورمزه>: ${code}`,
    copyCode: "نسخ الرمز",
    copied: "تم النسخ ✓",
    more: "[تعرّفي|تعرّف] على باقي الميزات",
    toPage: "الانتقال إلى صفحة {name}",
    toPlan: "الانتقال إلى «<خطتها|خطته>»",
  },
} as const;

/** «سورة واحدة» / «سورتان» / «3 سور» / «11 سورة». */
export function surahsCount(n: number): string {
  if (n === 1) return "سورة واحدة";
  if (n === 2) return "سورتان";
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${n} سور`;
  return `${n} سورة`;
}

/** The four switches of question 4, in their order. */
export const START_FEATURES = [
  { key: "agenda", title: "الجدول اليومي", desc: "لكل بند وقت، <فترى|فيرى> {name} ما <عليها|عليه> الآن وما بعده." },
  { key: "streak", title: "أيام الالتزام والسلسلة", desc: "🔥 في صفحة {name} مع عدد الأيام التي <التزمت|التزم> فيها متتاليةً. [تختارين|تختار] أيامها من «إعدادات {name}»." },
  { key: "homeLog", title: "حفظي في البيت", desc: "<تتدرّب|يتدرّب> {name} على المقطع في البيت قبل تسميعه: سماع، وتكرار، وتسميع لأحد." },
  { key: "review", title: "تذكير المراجعة", desc: "تنبيه في صفحة {name} بكل سورة <أتمّت|أتمّ> حفظها ولم <تراجعها|يراجعها> منذ 14 يومًا." },
] as const;

export type StartFeature = (typeof START_FEATURES)[number]["key"];

/** The remaining features (section ٢), in their order: each shows only while off (and where it can be on). */
export const MORE_FEATURES = [
  { key: "goal", title: "هدف الحفظ", text: "[تضعين|تضع] لـ{name} هدفًا، مثل إتمام جزء عمّ قبل رمضان، <فترى|فيرى> في <صفحتها|صفحته> المطلوب كل يوم." },
  { key: "mutashabihat", title: "المتشابهات", text: "علامة ≈ بعد الآيات التي لها آيات متشابهة في القرآن، مع عرض تلك الآيات." },
  { key: "tajweed", title: "أخطاء التجويد المفصّلة", text: "عند التسميع مع {name} [تحدّدين|تحدّد] خطأ التجويد على الحرف نفسه أو بين كلمتين، مع ملخّص في <صفحتها|صفحته>." },
  { key: "homeMistakes", title: "تحديد أخطائي في البيت", text: "<تحدّد|يحدّد> {name} الكلمات التي <أخطأت|أخطأ> فيها أثناء التدريب في البيت، فتظهر في <كلماتها|كلماته> التي تحتاج مراجعة." },
  { key: "summary", title: "المحصّلات", text: "ملخّص لالتزام {name} بجدول المتابعة لكل أسبوع وشهر وسنة." },
  { key: "highlight", title: "التظليل", text: "<تظلّل|يظلّل> {name} مقاطع من الآيات <لتنتبه|لينتبه> لها أثناء الحفظ." },
] as const;

export type MoreFeature = (typeof MORE_FEATURES)[number]["key"];

/** Which remaining features show: the ones off, «تحديد أخطائي في البيت» only with «حفظي في البيت», «التظليل» only where it reaches the family. */
export function moreFeaturesFor(on: Record<MoreFeature, boolean>, homeLog: boolean, highlightReaches: boolean): MoreFeature[] {
  return MORE_FEATURES.map((f) => f.key).filter((k) => !on[k] && (k !== "homeMistakes" || homeLog) && (k !== "highlight" || highlightReaches));
}

export const MORE = {
  progress: (i: number, n: number) => `ميزة ${i} من ${n}`,
  enable: "تفعيل",
  notNow: "ليس الآن",
  back: "السابق",
  toPage: "الانتقال إلى صفحة {name}",
  enabled: (title: string) => `تم تفعيل «${title}» ✓`,
  doneTitle: "[انتهيتِ|انتهيتَ] من الميزات ✓",
  doneList: (titles: string[]) => (titles.length ? `فُعّلت: ${titles.map((t, i) => (i === 0 ? t : `و${t}`)).join("، ")}.` : "لم [تفعّلي|تفعّل] شيئًا الآن."),
  goalNote: "[ضعي|ضع] الهدف من «<خطتها|خطته>» ← «+ هدف للحفظ».",
  change: "[يمكنكِ|يمكنك] تغيير كل ذلك من «إعدادات {name}».",
} as const;
