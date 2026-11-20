import "server-only";
import type { CourseFeature } from "./types";

// The courses' guide words that only the server uses: which settings card
// switches each feature on (the supervisor's «تفعيل الآن»), and the names of
// the buttons a tour waits on. Server only, because «أيام العذر» is among
// them: its card's name reaches a browser only with that viewer's excuse
// help (course-guide.ts).

/** The settings card that switches each feature on: its anchor and its title. */
export const FEATURE_CARD: Record<CourseFeature | "excuse", { card: string; title: string }> = {
  studentLogin: { card: "studentLogin", title: "دخول الطلاب" },
  studentBoard: { card: "studentLogin", title: "دخول الطلاب" },
  homeLog: { card: "studentLogin", title: "دخول الطلاب" },
  homeMistakes: { card: "studentLogin", title: "دخول الطلاب" },
  assignments: { card: "studentLogin", title: "دخول الطلاب" },
  tracker: { card: "studentLogin", title: "دخول الطلاب" },
  agenda: { card: "studentLogin", title: "دخول الطلاب" },
  summary: { card: "studentLogin", title: "دخول الطلاب" },
  calendar: { card: "calendar", title: "التقويم الهجري" },
  online: { card: "online", title: "أنواع التسميع" },
  board: { card: "board", title: "رمز لوحة الإنجاز العامة" },
  studentInfo: { card: "info", title: "معلومات إضافية" },
  parentInfoEdit: { card: "info", title: "معلومات إضافية" },
  streak: { card: "streak", title: "الأسابيع المتتالية 🔥" },
  review: { card: "review", title: "تذكير المراجعة" },
  tajweed: { card: "tajweed", title: "أخطاء التجويد المفصّلة" },
  similarStaff: { card: "similar", title: "المتشابهات" },
  similarStudents: { card: "similar", title: "المتشابهات" },
  excuse: { card: "excuse", title: "أيام العذر · لمجموعات البنات" },
};

/**
 * The name of each button a course tour waits on («اضغطي «…» للمتابعة»), as the
 * page shows it; <f|m> filled on the server. Rafiq's own labels (PRESS_LABELS)
 * cover the student's tracker and home log; these come on top.
 */
export const COURSE_PRESS_LABELS: Record<string, string | { plain: string }> = {
  "c.studentCard": { plain: "على بطاقة <الطالبة|الطالب>" },
  "c.select": "تحديد",
  "c.addMenu": "+ إضافة <طالبة|طالب>",
  "c.codesMenu": { plain: "زرّ الرموز أعلى القائمة" },
  "c.offlineMenu": "📄 تسميع بدون إنترنت",
  "c.archiveLink": "الأرشيف",
  "c.points": "النقاط اليوم",
  "c.plan": "🗺 خطة الحفظ",
  "c.planEdit": "تعديل الخطة",
  "c.addPrior": "+ إضافة حفظ سابق",
  "c.manageEdit": "✎ تعديل البيانات",
  "c.manageArchive": "🗄 أرشفة",
  "c.parentCode": "رمز دخول وليّ الأمر",
  "c.studentCode": "رمز دخول <الطالبة|الطالب>",
  "c.codesPrint": "🖨️ طباعة القائمة",
  "c.assignNew": "+ واجب جديد",
  "c.trNewItem": "+ بند جديد",
  "c.trOrder": "ترتيب البنود",
  "c.card.code": "رمز الدورة للمعلمين",
  "c.card.board": "رمز لوحة الإنجاز العامة",
  "c.card.perms": "صلاحيات المعلمين",
  "c.card.timezone": "التوقيت",
  "c.card.review": "تذكير المراجعة",
  "c.card.streak": "الأسابيع المتتالية 🔥",
  "c.card.studentLogin": "دخول الطلاب",
  "c.card.info": "معلومات إضافية",
  "c.card.calendar": "التقويم الهجري",
  "c.card.groups": "مجموعات الدورة",
  "c.card.points": "نظام النقاط",
  "c.stOwnItem": "+ بند خاص",
  "c.pInfo": "✎ تعديل المعلومات",
  "calendar.add": "+ إضافة فعالية",
  "tracker.summary": "📊 المحصّلات",
  "practice.back": "→ مقاطعي",
};

/** The excuse card's button name: only for a viewer who gets the excuse help. */
export const EXCUSE_CARD_LABEL = { "c.card.excuse": "أيام العذر · لمجموعات البنات" };
