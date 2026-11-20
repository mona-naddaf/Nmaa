import "server-only";
import type { CourseRawPage, ParentFacts } from "./types";

// The help on a parent's page (/parent). [f|m] is the parent: neutral
// wording where it can be, the masculine otherwise (the code is shared by both
// parents, so who is looking isn't known). <f|m>: the child, by her group.
// Server only.

export const PARENT_HELP: CourseRawPage<ParentFacts>[] = [
  {
    id: "p.home",
    title: "متابعة وليّ الأمر",
    welcome: "هنا متابعة <ابنتك|ابنك>: <موقعها|موقعه> في الخطة، <وحضورها|وحضوره>، <ونقاطها|ونقاطه>، وسجل <تسميعها|تسميعه>. الصفحة للعرض فقط.",
    questions: [
      {
        id: "P1.1",
        q: "أين <وصلت|وصل> في الحفظ؟",
        showMe: true,
        steps: [
          { text: "في «آخر ما <وصلت|وصل> إليه (حسب الخطة)».", target: "c.pPosition" },
          { text: "يتقدّم الموقع بكل تسميع جديد يُسجَّل في الحلقة." },
        ],
      },
      {
        id: "P1.2",
        q: "كيف أرى الحضور والنقاط في فترة معيّنة؟",
        showMe: true,
        steps: [
          {
            text: "[اختاري|اختر] الفترة: «الدورة كاملة» أو «آخر 4 أسابيع» أو غيرهما.",
            target: "c.pRange",
            missing: "لا توجد بيانات مسجّلة بعد.",
          },
          { text: "تتغيّر الأرقام وسجل التسميع تحتها بحسب الفترة." },
        ],
      },
      {
        id: "P1.3",
        q: "أين سجل التسميع؟",
        showMe: true,
        steps: [{ text: "في «سجل التسميع» أسفل الصفحة: كل جلسة بتاريخها وتقييمها.", target: "c.pHistory", missing: "لا توجد بيانات مسجّلة بعد." }],
      },
      {
        id: "P1.4",
        q: "كيف أعدّل معلومات <ابنتي|ابني>؟",
        showMe: true,
        feat: "parentInfoEdit",
        hideOff: true,
        show: (f) => f.infoFields,
        steps: [
          { text: "[اضغطي|اضغط] «✎ تعديل المعلومات».", target: "c.pInfo", kind: "press" },
          { text: "[اكتبي|اكتب] المعلومات." },
          { text: "[اضغطي|اضغط] «حفظ»." },
        ],
      },
      {
        id: "P1.5",
        q: "ما «🏠 حفظ البيت»؟",
        showMe: true,
        feat: "homeLog",
        hideOff: true,
        steps: [{ text: "ما <تتدرّب|يتدرّب> عليه في البيت من مقاطع، للعرض فقط. لا يغيّر <موقعها|موقعه> في الخطة.", target: "c.pHomeLog" }],
      },
      {
        id: "P1.6",
        q: "ما «✅ جدول المتابعة»؟",
        showMe: true,
        feat: "tracker",
        hideOff: true,
        more: true,
        steps: [{ text: "ما <علّمته|علّمه> من <بنودها|بنوده> اليومية هذا الأسبوع، بدرجة كل يوم.", target: "c.pTracker" }],
      },
      {
        id: "P1.7",
        q: "هل يمكنني تعديل شيء هنا؟",
        showMe: false,
        more: true,
        steps: [{ text: "لا. الصفحة للعرض فقط، ويظهر فيها ما يُسجَّل في الحلقة." }],
      },
      {
        id: "P1.8",
        q: "هل يدخل الوالدان بالرمز نفسه؟",
        showMe: false,
        more: true,
        steps: [{ text: "نعم. الرمز واحد لكلا الوالدين، ويدخل به كلٌّ منهما من جهازه." }],
      },
    ],
  },
];
