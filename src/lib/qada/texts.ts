import { GREGORIAN_MONTHS, WEEKDAYS, daysBetween, weekday } from "@/lib/calendar/hijri";
import { KIND_NAMES, KIND_SHORT, PRAYERS, type PrayerKind, type QadaKind, type QadaTrack } from "./kinds";
import type { SuggestionReason } from "./fasting-days";

// «القضاء»: every text of the feature, in both genders. Draft — to be
// reviewed with Mona on the text review page before it's final. Western
// digits, like the rest of the site. Pure.
//
// you: the one looking (her own page, a child on hers, an adult on a
// child's); who: on an adult's view of a child, the child (name + gender).

export type G = "MALE" | "FEMALE";
export type Who = { name: string; gender: G } | null;

const pick = (g: G, m: string, f: string) => (g === "FEMALE" ? f : m);

// ---------- counted nouns (digits) ----------

const tens = (n: number) => n % 100;
/** «يوم واحد» / «يومان» / «3 أيام» / «11 يومًا» / «100 يوم». */
export function daysCount(n: number): string {
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومان";
  const r = tens(n);
  if (n >= 100 && r <= 2) return `${n} يوم`;
  if (r >= 3 && r <= 10) return `${n} أيام`;
  return `${n} يومًا`;
}
/** «صلاة واحدة» / «صلاتان» / «3 صلوات» / «11 صلاة». */
export function prayersCount(n: number): string {
  if (n === 1) return "صلاة واحدة";
  if (n === 2) return "صلاتان";
  const r = tens(n);
  if (r >= 3 && r <= 10 && !(n >= 100 && r <= 2)) return `${n} صلوات`;
  return `${n} صلاة`;
}
const monthsCount = (n: number) => (n === 1 ? "شهر" : n === 2 ? "شهرين" : n <= 10 ? `${n} أشهر` : `${n} شهرًا`);

/** «الاثنين 16 نوفمبر» (the year only when it isn't this one). */
export function dayLabel(iso: string, today: string): string {
  if (iso === today) return "اليوم";
  if (daysBetween(iso, today) === 1) return "أمس";
  const [y, m, d] = iso.split("-").map(Number);
  const base = `${WEEKDAYS[weekday(iso)]} ${d} ${GREGORIAN_MONTHS[m - 1]}`;
  return y === Number(today.slice(0, 4)) ? base : `${base} ${y}`;
}

/** «16 نوفمبر 2026» */
export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${GREGORIAN_MONTHS[m - 1]} ${y}`;
}

// ---------- the card ----------

export const QADA_TITLE = "القضاء";
export const cardTitle = (who: Who) => (who ? `قضاء ${who.name}` : QADA_TITLE);
export const TRACK_TITLE: Record<QadaTrack, string> = { prayers: "الصلوات", fast: "الصيام" };

export const remainingLabel = (k: QadaKind, n: number) => (k === "FAST" ? `بقي ${daysCount(n)}` : `بقي ${n}`);
export function trackLine(t: QadaTrack, remaining: number, done: number): string {
  const count = t === "fast" ? daysCount : prayersCount;
  return done === 0 ? `بقي ${count(remaining)}` : `بقي ${count(remaining)} · قُضي ${count(done)}`;
}
export const pctLabel = (pct: number) => `${Math.floor(pct)}%`;

export const PLUS_ONE = "+1";
export const plusOneLabel = (k: QadaKind) => (k === "FAST" ? "تسجيل يوم صيام مقضيّ" : `تسجيل صلاة ${KIND_NAMES[k]} مقضيّة`);
export const HIDDEN_NUMBER = "•••";
export const hideLabel = (hidden: boolean) => (hidden ? "إظهار الأرقام" : "إخفاء الأرقام");

export const EARLIER_DAY = "في يوم سابق";
export const EARLIER_HINT = (you: G) => `${pick(you, "اختر", "اختاري")} اليوم، ثم ${pick(you, "اضغط", "اضغطي")} «+1».`;
export const loggedToast = (k: QadaKind, day: string, today: string) =>
  `${k === "FAST" ? "سُجّل يوم صيام" : `سُجّلت صلاة ${KIND_NAMES[k]}`}${day === today ? "" : ` (${dayLabel(day, today)})`} ✓`;
export const UNDO = "تراجع";
export const UNDONE = "تم التراجع ✓";

export function emptyText(you: G, who: Who): string {
  if (who) return `لم يُضَف قضاء ${pick(who.gender, "له", "لها")} بعد.`;
  return `${pick(you, "أضف", "أضيفي")} ما ${pick(you, "عليك", "عليكِ")} من قضاء الصلاة والصيام، ${pick(you, "وتابع", "وتابعي")} ما ${pick(you, "تقضيه", "تقضينه")} يومًا بيوم. لا تؤثّر هذه البطاقة في نسبة ${pick(you, "يومك", "يومكِ")}.`;
}

export const BUTTONS = {
  add: "+ إضافة قضاء",
  estimate: "حساب تقديري",
  log: "السجل",
  goal: "الهدف",
  settings: "الإعدادات",
  close: "إغلاق",
  cancel: "إلغاء",
};

// ---------- today and the goal ----------

export const TODAY = "اليوم:";
export const todayPart = (k: PrayerKind, done: number, need: number) => `${KIND_SHORT[k]} ${Math.min(done, need)}/${need}`;
export const todayPlain = (per: Record<PrayerKind, number>) =>
  PRAYERS.filter((p) => per[p] > 0)
    .map((p) => `${per[p]} ${KIND_SHORT[p]}`)
    .join("، ");
export const todayDone = (you: G, who: Who) =>
  who ? `${pick(who.gender, "أتمّ", "أتمّت")} ${who.name} مقدار اليوم 🌿` : `${pick(you, "أتممتَ", "أتممتِ")} مقدار اليوم، تقبّل الله 🌿`;
export const ahead = (you: G, who: Who) =>
  who ? `ما شاء الله، ${who.name} ${pick(who.gender, "متقدّم", "متقدّمة")} 🌿` : `ما شاء الله، ${pick(you, "أنتَ متقدّم", "أنتِ متقدّمة")} 🌿`;
export const extendQuestion = (you: G) => `هل ${pick(you, "تودّ", "تودّين")} تمديد الموعد؟`;
export const EXTEND = "تمديد الموعد";
export const deadlineLine = (iso: string) => `الموعد: ${dateLabel(iso)}`;
export const finishLine = (iso: string | null) => (iso ? `الانتهاء المتوقّع: ${dateLabel(iso)}` : "");
export const paceLine = (t: QadaTrack, pace: number) => (t === "fast" ? `الوتيرة: ${daysCount(pace)} في الأسبوع` : `الوتيرة: ${pace} من كل صلاة يوميًا`);

/** «تقريبًا يومان في الأسبوع» / «تقريبًا 3 أيام في الشهر» / «تقريبًا يوم كل 3 أشهر». */
export function perWeekLabel(perWeek: number): string {
  if (perWeek >= 0.75) {
    const n = Math.min(7, Math.max(1, Math.round(perWeek)));
    return `تقريبًا ${n === 1 ? "يوم" : daysCount(n)} في الأسبوع`;
  }
  const perMonth = (perWeek * 30) / 7;
  if (perMonth >= 0.75) {
    const n = Math.max(1, Math.round(perMonth));
    return `تقريبًا ${n === 1 ? "يوم" : daysCount(n)} في الشهر`;
  }
  return `تقريبًا يوم كل ${monthsCount(Math.max(2, Math.round(1 / Math.max(perMonth, 1e-6))))}`;
}

export const SUGGESTED = "أيام مقترحة:";
export const REASONS: Record<SuggestionReason, string> = { MONDAY: "الاثنين", THURSDAY: "الخميس", WHITE: "الأيام البيض" };
export const suggestionNote = (you: G) => `اقتراحات فقط؛ أي يوم ${pick(you, "تسجّله", "تسجّلينه")} يُحسب.`;

// ---------- milestones ----------

const PART: Record<25 | 50 | 75, string> = { 25: "ربع", 50: "نصف", 75: "ثلاثة أرباع" };
const OF: Record<QadaTrack, string> = { prayers: "قضاء الصلوات", fast: "قضاء الصيام" };
export const milestoneLine = (m: 25 | 50 | 75, t: QadaTrack, you: G) => `${pick(you, "أتممتَ", "أتممتِ")} ${PART[m]} ${OF[t]}، تقبّل الله 🌿`;
export const celebrationTitle = (you: G) => `تقبّل الله ${pick(you, "منك", "منكِ")}`;
export const celebrationLine = (t: QadaTrack, you: G) => `${pick(you, "أتممتَ", "أتممتِ")} ${OF[t]} كلّه 🌿`;

// ---------- «السجل» ----------

export const LOG_TITLE = "السجل";
export const LOG_EMPTY = "لا شيء في السجل بعد.";
export const LOG_NOTE_NO_DATES = "يظهر السجل هنا دون تواريخ.";
export const LOG_KIND = { OWED: "أُضيف قضاء", MADE_UP: "قُضي", ESTIMATE: "تقدير", FULL_DAY: "يوم كامل" } as const;
export const logParts = (parts: { kind: QadaKind; count: number }[]) =>
  parts.map((p) => (p.kind === "FAST" ? `الصيام ${p.count}` : `${KIND_NAMES[p.kind]} ${p.count}`)).join("، ");
export const fullDayParts = (n: number) => `${daysCount(n)} (${n} من كل صلاة)`;
export const logForDay = (iso: string, today: string) => `عن ${dayLabel(iso, today)}`;
export const logAddedAt = (iso: string) => {
  const d = new Date(iso);
  return `سُجّل ${d.getDate()} ${GREGORIAN_MONTHS[d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const logBy = (name: string | null) => `بواسطة ${name ?? "أحد البالغين"}`;
export const DELETE_LINE = "حذف";
export const deleteLineQuestion = "حذف هذا السطر من السجل؟";
export const DELETE_YES = "نعم، حذف";

// ---------- «+ إضافة قضاء» ----------

export const ADD_TITLE = "إضافة قضاء";
export const ADD_KIND = "النوع";
export const ADD_COUNT = "العدد";
export const ADD_DATE = "التاريخ (اختياري)";
export const ADD_SUBMIT = "إضافة";
export const FULL_DAY_TITLE = "يوم كامل";
export const FULL_DAY_NOTE = "يضيف هذا العدد من كل صلاة من الصلوات الخمس.";
export const FULL_DAY_COUNT = "عدد الأيام";
export const added = "تمت الإضافة ✓";

// ---------- the goal ----------

export const GOAL_TITLE: Record<QadaTrack, string> = { prayers: "هدف الصلوات", fast: "هدف الصيام" };
export const GOAL_MODES = { DEADLINE: "موعد", PACE: "وتيرة", NONE: "بدون" } as const;
export const goalModeHint = (t: QadaTrack, you: G) => ({
  DEADLINE:
    t === "prayers"
      ? `${pick(you, "اختر", "اختاري")} يومًا ${pick(you, "تنتهي", "تنتهين")} قبله، ${pick(you, "فترى", "فترين")} كل يوم ما ${pick(you, "عليك", "عليكِ")} من كل صلاة.`
      : `${pick(you, "اختر", "اختاري")} يومًا ${pick(you, "تنتهي", "تنتهين")} قبله، ${pick(you, "فترى", "فترين")} كم يومًا في الأسبوع تقريبًا.`,
  PACE:
    t === "prayers"
      ? `${pick(you, "اختر", "اختاري")} كم من كل صلاة يوميًا، ${pick(you, "فترى", "فترين")} متى ${pick(you, "تنتهي", "تنتهين")} تقريبًا.`
      : `${pick(you, "اختر", "اختاري")} كم يومًا في الأسبوع، ${pick(you, "فترى", "فترين")} متى ${pick(you, "تنتهي", "تنتهين")} تقريبًا.`,
  NONE: "العدد والتقدّم فقط.",
});
export const GOAL_DEADLINE = "الموعد";
export const GOAL_PACE: Record<QadaTrack, string> = { prayers: "من كل صلاة يوميًا", fast: "أيام في الأسبوع" };
export const GOAL_EXCUSE_NOTE = "تُستثنى أيام العذر المتوقّعة من الحساب من البداية.";
export const GOAL_FAST_NOTE = "لا يُحسب في الخطة رمضان ويوما العيد وأيام التشريق وآخر يوم من شعبان.";
export const GOAL_SAVE = "حفظ الهدف";
export const goalSaved = "تم حفظ الهدف ✓";

// ---------- the estimate ----------

export const ESTIMATE_TITLE = "حساب تقديري";
export const estimateNote = (you: G) => `تقدير تقريبي فقط، وليس حكمًا شرعيًا. ${pick(you, "عدّل", "عدّلي")} الأرقام كما ${pick(you, "ترى", "ترين")} قبل الحفظ.`;
export const EST_PRAYERS = "أيّ الصلوات؟";
export const EST_ALL = "الكل";
export const EST_DURATION = "المدة";
export const EST_YEARS = "سنوات";
export const EST_MONTHS = "أشهر";
export const EST_EXCLUDE_RAMADAN = "استثناء رمضان";
export const EST_EXCUSE = "كم يوم العذر في الشهر تقريبًا؟";
export const EST_FAST = "الصيام";
export const EST_RAMADANS = "عدد الرمضانات";
export const EST_RAMADANS_NOTE = "يُضرب في أيام العذر.";
export const EST_FAST_DAYS = "عدد أيام الصيام";
export const EST_CALC = "احسب";
export const estPreviewTitle = (you: G) => `النتيجة (${pick(you, "يمكنك", "يمكنكِ")} تعديلها)`;
export const EST_REPLACE = "يحلّ هذا محلّ التقدير السابق في السجل.";
export const EST_SAVE = "حفظ التقدير";
export const EST_BACK = "رجوع";
export const estimateSaved = "تم حفظ التقدير ✓";

// ---------- the card's settings ----------

export const AVG_TITLE = "متوسط أيام العذر في الشهر";
export const avgNote = (who: Who) => (who ? `يُستعمل في خطة ${who.name}، ولا يراه إلا ${who.name} ومن في القائمة.` : "يُستعمل في خطتكِ، ولا يراه أحد غيركِ.");
export const SAVE = "حفظ";
export const SAVED = "تم الحفظ ✓";
export const DELETE_ALL_TITLE = "حذف كل بيانات القضاء";
export const DELETE_ALL_NOTE = "يُحذف السجل كله والأهداف والتقدير نهائيًا، ولا يمكن التراجع عن ذلك.";
export const QADA_DELETE_WORD = "حذف";
export const deleteAllPrompt = (you: G) => `${pick(you, "اكتب", "اكتبي")} «${QADA_DELETE_WORD}» للتأكيد`;
export const DELETE_ALL_BUTTON = "حذف نهائيًا";
export const deletedAll = "حُذفت كل بيانات القضاء.";

// ---------- the settings pages ----------

export const SWITCH_LABEL = "تفعيل القضاء";
export const settingsSelf = (you: G) =>
  `بطاقة أسفل «جدول المتابعة» ${pick(you, "تتابع", "تتابعين")} فيها قضاء الصلوات والصيام: ما ${pick(you, "عليك", "عليكِ")}، وما ${pick(you, "قضيته", "قضيتِه")}، وهدفًا إن ${pick(you, "شئت", "شئتِ")}. لا تؤثّر في نسبة ${pick(you, "يومك", "يومكِ")} ولا في المحصّلات، ولا يراها أحد ${pick(you, "غيرك", "غيركِ")}، ولا تُشارَك مع العائلة.`;
export const childSwitchWhat = (who: { name: string; gender: G }) =>
  `بطاقة أسفل جدول ${who.name} لقضاء الصلوات والصيام. ${pick(who.gender, "يراها", "تراها")} ${who.name} ومن له صلاحية التعديل فقط.` +
  (who.gender === "FEMALE" ? ` أما قضاء الصيام ومتوسط أيام العذر والخطة فلا يراها إلا من في قائمة «من يرى أن ${who.name} معذورة؟».` : "");
export const QADA_LIST_NOTE = "هي القائمة نفسها في «أيام العذر». من حُدِّد يرى قضاء الصيام والخطة، ومن لم يُحدَّد يرى الصلوات وتقدّمها فقط، والسجل دون تواريخ.";

// ---------- errors ----------

export const ERR = {
  fail: "تعذّر الحفظ، يُرجى المحاولة مرة أخرى",
  notAvailable: "القضاء غير متاح هنا.",
  count: "العدد من 1 إلى 100000.",
  day: "التاريخ غير صحيح.",
  earlier: "يمكن التسجيل لليوم أو لسبعة أيام سابقة فقط.",
  madeUpCount: "العدد من 1 إلى 100.",
  ramadanCount: "العدد من 1 إلى 30.",
  kind: "يُرجى اختيار النوع.",
  deadline: "يُرجى اختيار موعد بعد اليوم.",
  pace: "يُرجى إدخال رقم صحيح.",
  estimate: "يُرجى مراجعة الأرقام.",
  avg: "من 0 إلى 15 يومًا.",
  deleteWord: `يُرجى كتابة «${QADA_DELETE_WORD}» للتأكيد.`,
  gone: "لم يعد هذا السطر موجودًا.",
};
export const qadaListAbove = (name: string) => `يرى قضاء الصيام والخطة من حُدِّد في قائمة «من يرى أن ${name} معذورة؟» أعلاه.`;

// ---------- «+ عدد» and the collapsed card (live test, 2026-11-16) ----------

export const PLUS_MANY = "+ عدد";
export const plusManyLabel = (k: QadaKind) => (k === "FAST" ? "تسجيل عدد من أيام الصيام المقضيّة" : `تسجيل عدد من صلاة ${KIND_NAMES[k]} المقضيّة`);
export const MANY_COUNT = "العدد";
export const MANY_DAY = "اليوم";
export const MANY_SUBMIT = "تسجيل";
/** «+ عدد»'s day choices: today, then up to 7 days back. */
export const manyDayLabel = (iso: string, today: string) => dayLabel(iso, today);
export const loggedManyToast = (k: QadaKind, n: number, day: string, today: string) =>
  `${k === "FAST" ? `سُجّل من الصيام: ${daysCount(n)}` : `سُجّلت ${prayersCount(n)} من ${KIND_NAMES[k]}`}${day === today ? "" : ` (${dayLabel(day, today)})`} ✓`;

export const collapseLabel = (open: boolean) => (open ? "طيّ البطاقة" : "فتح البطاقة");
/** The collapsed card's one line: «القضاء · بقي 2529 صلاة · 21 يومًا». */
export function collapsedLine(who: Who, prayersLeft: number | null, fastLeft: number | null): string {
  const parts = [cardTitle(who)];
  const rest = [prayersLeft !== null ? prayersCount(prayersLeft) : null, fastLeft !== null ? daysCount(fastLeft) : null].filter(Boolean);
  if (rest.length) parts.push(`بقي ${rest.join(" · ")}`);
  return parts.join(" · ");
}

// ---------- Phase 2: «يُحسب قضاءً» on a tracker item ----------

export const LINK_FIELD = "يُحسب قضاءً";
export const LINK_NONE = "لا";
export const linkOption = (k: QadaKind) => (k === "FAST" ? "الصيام" : `صلاة ${KIND_NAMES[k]}`);
export const linkHint = (you: G) =>
  `كل يوم ${pick(you, "تعلّم", "تعلّمين")} فيه هذا البند يُضاف إلى «القضاء» واحد، ويُرفع إن ${pick(you, "أزلت", "أزلتِ")} العلامة.`;
export const linkLine = (k: QadaKind) => `${LINK_FIELD}: ${linkOption(k)}`;
export const LINK_ONE_CHILD = "يُحسب قضاءً لهذا الطفل وحده، لا عند الإضافة إلى أكثر من طفل.";
/** «السجل»: an entry from a ticked item. */
export const logFromItem = (title: string | null) => (title ? `من بند «${title}» في الجدول` : "من بند في الجدول");

// ---------- Phase 2: the Ramadan offer ----------

export const ramadanQuestion = (n: number) => `أُضيف ${daysCount(n)} إلى قضاء الصيام؟`;
export const ramadanBasis = (year: number, who: Who) =>
  who ? `حسب أيام العذر التي سُجّلت ل${who.name} في رمضان ${year} هـ.` : `حسب أيام العذر التي سجّلتِها في رمضان ${year} هـ.`;
export const RAMADAN_COUNT = "عدد الأيام";
export const RAMADAN_ADD = "إضافة";
export const RAMADAN_LATER = "ليس الآن";
/** Without a place: her own city (an adult), or the family's (a child's pages). */
export const ramadanNoCity = (you: G, family: boolean) =>
  family
    ? "حين تُحدَّد مدينة العائلة يُحسب حسب وقت الصيام بدقّة."
    : `${pick(you, "حدّد", "حدّدي")} ${pick(you, "مدينتك", "مدينتكِ")} في الإعدادات ليُحسب حسب وقت الصيام بدقّة.`;
export const ramadanAdded = "أُضيف إلى قضاء الصيام ✓";

// ---------- Phase 2: the line before Ramadan ----------

export const reminderLine = (daysLeft: number, remaining: number, you: G, who: Who) =>
  `بقي على رمضان ${daysCount(daysLeft)}، و${who ? `على ${who.name}` : pick(you, "عليك", "عليكِ")} ${daysCount(remaining)} من قضاء الصيام.`;
export const reminderShort = (daysLeft: number) => `رمضان بعد ${daysCount(daysLeft)}`;
export const REMINDER_HIDE = "إخفاء لليوم";

// ---------- Phase 2: her predicted cycle ----------

export const predictionLine = (p: { cycle: number; duration: number }, who: Who) =>
  `حسب ${who ? `سجلّ ${who.name}` : "سجلّكِ"}: كل ${daysCount(p.cycle)} تقريبًا، لمدة ${daysCount(p.duration)}.`;
export const predictionUsed = "يُستعمل هذا في الخطة بدل المتوسط المكتوب.";
export const PREDICTION_NOT_YET = "بعد ثلاث دورات كاملة في «أيام العذر» يُحسب المتوسط من السجل.";
export const ownAverageSwitch = (avg: number | null, who: Who) =>
  `${who ? "استعمال الرقم المكتوب" : "استعمال رقمي أنا"}${avg !== null ? ` (${daysCount(avg)} في الشهر)` : ""}`;
