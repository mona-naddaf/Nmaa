import "server-only";
import type { CourseRawPage } from "./types";

// The help on the supervisor's and the teachers' pages. [f|m]: the one
// looking (staff with no gender recorded read feminine); <f|m>: the course's
// students (feminine when every group is a girls' group). Server only: the
// builder (build.ts) keeps for each viewer only her own questions.

export const STAFF_HELP: CourseRawPage[] = [
  {
    id: "s.students",
    title: "قائمة الطلاب",
    welcome: "هنا كل <طالبات|طلاب> الدورة، لكل مجموعة تبويب. [اضغطي|اضغط] على بطاقة لفتح صفحة التسميع.",
    questions: [
      {
        id: "S1.1",
        q: "كيف أسجّل تسميع <طالبة|طالب>؟",
        showMe: true,
        steps: [
          {
            text: "[اضغطي|اضغط] على بطاقة <الطالبة|الطالب>.",
            target: "c.studentCard",
            kind: "press",
            missing: "لا <طالبات|طلاب> في هذه المجموعة بعد. [اختاري|اختر] مجموعة أخرى، أو [أضيفي|أضف] <طالبة|طالبًا> أولًا.",
          },
          { text: "في «تسجيل تسميع جديد» [اختاري|اختر] نوع الجلسة والسورة والآيات ومستوى التسميع.", target: "c.recordForm", page: "s.student" },
          { text: "[اضغطي|اضغط] «حفظ التسميع».", target: "c.recordSave", kind: "save", page: "s.student" },
        ],
      },
      {
        id: "S1.2",
        q: "كيف أسجّل الحضور أو نقطة لعدد منهم معًا؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «تحديد».", target: "c.select", kind: "press" },
          {
            text: "[اضغطي|اضغط] على البطاقات، أو «تحديد الكل».",
            target: "c.selectAll",
            via: ["c.select"],
          },
          {
            text: "[اختاري|اختر] من الشريط أسفل الصفحة: الحضور، أو الغياب، أو «+ نقطة».",
            target: "c.bulkBar",
            missing: "يظهر الشريط بعد تحديد بطاقة واحدة على الأقل.",
          },
        ],
        notes: ["يظهر «تراجع» بضع ثوانٍ بعد كل تسجيل."],
      },
      {
        id: "S1.3",
        q: "كيف أضيف <طالبة|طالبًا>؟",
        showMe: true,
        perm: "add",
        steps: [
          { text: "[اضغطي|اضغط] «+ إضافة <طالبة|طالب>».", target: "c.addMenu", kind: "press" },
          { text: "[اختاري|اختر] «إضافة يدوية»، أو «استيراد من Excel» لعدد كبير." },
        ],
      },
      {
        id: "S1.4",
        q: "كيف أبحث عن <طالبة|طالب>؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] اسم المجموعة إن كانت في مجموعة أخرى.", target: "c.groupTabs" },
          { text: "[اكتبي|اكتب] جزءًا من الاسم في خانة البحث.", target: "c.search" },
        ],
        notes: ["يبحث في المجموعة المفتوحة فقط."],
      },
      {
        id: "S1.5",
        q: "ماذا تعني العلامات على البطاقة؟",
        showMe: true,
        steps: [
          {
            text: "أسفل البطاقة حضور اليوم.",
            target: "c.studentCard",
            missing: "لا <طالبات|طلاب> في هذه المجموعة بعد.",
          },
          { text: "🔥 عدد الأسابيع المتتالية، و🔁 عدد السور التي تحتاج مراجعة." },
          { text: "والرقم في طرف البطاقة مجموع نقاط الدورة." },
        ],
      },
      {
        id: "S1.6",
        q: "أين رموز أولياء الأمور <والطالبات|والطلاب>؟",
        showMe: true,
        more: true,
        adminOnly: true,
        show: (f) => f.features.studentLogin,
        steps: [
          { text: "[اضغطي|اضغط] «الرموز».", target: "c.codesMenu", kind: "press" },
          { text: "[اختاري|اختر] «رموز أولياء الأمور» أو «رموز <الطالبات|الطلاب>»." },
        ],
      },
      {
        id: "S1.6a",
        q: "أين رموز أولياء الأمور؟",
        showMe: true,
        more: true,
        adminOnly: true,
        show: (f) => !f.features.studentLogin,
        steps: [{ text: "[اضغطي|اضغط] «رموز أولياء الأمور» أعلى القائمة.", target: "c.codesMenu", kind: "press" }],
        notes: ["رمز وليّ الأمر واحد لكلا الوالدين."],
      },
      {
        id: "S1.6t",
        q: "أين رموز دخول <الطالبات|الطلاب>؟",
        showMe: true,
        more: true,
        perm: "codes",
        feat: "studentLogin",
        hideOff: true,
        show: (f) => f.role === "teacher",
        steps: [{ text: "[اضغطي|اضغط] «رموز <الطالبات|الطلاب>» أعلى القائمة.", target: "c.codesMenu", kind: "press" }],
      },
      {
        id: "S1.7",
        q: "كيف أسجّل التسميع بدون إنترنت؟",
        showMe: true,
        more: true,
        perm: "offline",
        steps: [
          { text: "[اضغطي|اضغط] «📄 تسميع بدون إنترنت».", target: "c.offlineMenu", kind: "press" },
          { text: "[اختاري|اختر] «تنزيل الملف» قبل الحلقة، ثم «رفع الملف» بعد تعبئته." },
        ],
      },
      {
        id: "S1.8",
        q: "أين من أرشفتُهم؟",
        showMe: true,
        more: true,
        adminOnly: true,
        steps: [{ text: "[اضغطي|اضغط] «الأرشيف» أسفل الصفحة.", target: "c.archiveLink", kind: "press" }],
      },
    ],
  },
  {
    id: "s.student",
    title: "صفحة <الطالبة|الطالب>",
    welcome: "هذه صفحة <الطالبة|الطالب>: [سجّلي|سجّل] هنا الحضور والتسميع والنقاط.",
    questions: [
      {
        id: "S2.1",
        q: "كيف أسجّل تسميعًا؟",
        showMe: true,
        steps: [
          { text: "[اختاري|اختر] نوع الجلسة: «حفظ جديد» أو «مراجعة» أو «ربط».", target: "record.type" },
          { text: "[اختاري|اختر] السورة والآيات ومستوى التسميع.", target: "c.recordForm" },
          { text: "[اضغطي|اضغط] على الكلمات التي فيها خطأ، إن وُجدت.", target: "record.flagger", optional: true },
          { text: "[اضغطي|اضغط] «حفظ التسميع».", target: "c.recordSave", kind: "save" },
        ],
        notes: ["يُحسب الموضع تلقائيًا، ويُطلب سبب إن خالف التسجيل ترتيب الخطة."],
      },
      {
        id: "S2.2",
        q: "كيف أسجّل الحضور؟",
        showMe: true,
        steps: [{ text: "[اضغطي|اضغط] «<حاضرة|حاضر> ✓» أو «<غائبة|غائب>» أعلى الصفحة.", target: "c.attendance" }],
        notes: ["يُحفظ فورًا لليوم."],
      },
      {
        id: "S2.3",
        q: "كيف أضيف نقطة؟",
        showMe: true,
        steps: [
          { text: "[افتحي|افتح] «النقاط اليوم».", target: "c.points", kind: "press" },
          { text: "[اضغطي|اضغط] على النشاط لإضافته، ومرة أخرى لإلغائه." },
          { text: "لنقطة لسبب آخر [اضغطي|اضغط] «+ نقاط إضافية»." },
          { text: "[اكتبي|اكتب] السبب، ثم [اضغطي|اضغط] «+1»." },
        ],
        notes: ["تُنسب النقاط إلى «تاريخ الجلسة» المختار في النموذج."],
      },
      {
        id: "S2.4",
        q: "كيف أعدّل خطة الحفظ؟",
        showMe: true,
        perm: "plan",
        steps: [
          { text: "[افتحي|افتح] «🗺 خطة الحفظ».", target: "c.plan", kind: "press" },
          { text: "[اضغطي|اضغط] «تعديل الخطة».", target: "c.planEdit", kind: "press", via: ["c.plan"] },
          { text: "[اختاري|اختر] قالبًا، أو [رتّبي|رتّب] السور." },
          { text: "[اضغطي|اضغط] «حفظ <خطتها|خطته>»." },
        ],
        notes: ["تغيير الخطة لا يحذف أي تسميع."],
      },
      {
        id: "S2.5",
        q: "كيف أضيف حفظًا سابقًا؟",
        showMe: true,
        perm: "prior",
        steps: [
          { text: "[اضغطي|اضغط] «+ إضافة حفظ سابق».", target: "c.addPrior", kind: "press" },
          { text: "[اختاري|اختر] ما حُفظ قبل الدورة." },
          { text: "[اضغطي|اضغط] «حفظ الحفظ السابق»." },
        ],
        notes: ["يُحسب في الموضع وأشرطة التقدّم، دون نقاط."],
      },
      {
        id: "S2.6",
        q: "كيف أعدّل البيانات أو أنقل إلى مجموعة أخرى؟",
        showMe: true,
        more: true,
        perm: "edit",
        steps: [
          { text: "[اضغطي|اضغط] «✎ تعديل البيانات» تحت الاسم.", target: "c.manageEdit", kind: "press" },
          { text: "[غيّري|غيّر] الاسم أو العمر أو الصف أو المجموعة." },
          { text: "[اضغطي|اضغط] «حفظ»." },
        ],
      },
      {
        id: "S2.7",
        q: "كيف أؤرشف <الطالبة|الطالب>؟",
        showMe: true,
        more: true,
        perm: "archive",
        steps: [
          { text: "[اضغطي|اضغط] «🗄 أرشفة» تحت الاسم.", target: "c.manageArchive", kind: "press" },
          { text: "[اضغطي|اضغط] «تأكيد الأرشفة»." },
        ],
        notes: ["يبقى السجل كله في الأرشيف، ويتوقف رمز وليّ الأمر."],
      },
      {
        id: "S2.8",
        q: "كيف أعطي وليّ الأمر رمز الدخول؟",
        showMe: true,
        more: true,
        adminOnly: true,
        steps: [
          { text: "[افتحي|افتح] «رمز دخول وليّ الأمر» أسفل الصفحة.", target: "c.parentCode", kind: "press" },
          { text: "[اضغطي|اضغط] «إنشاء رمز لوليّ الأمر»." },
          { text: "[أرسلي|أرسل] الرمز والرابط إلى وليّ الأمر." },
        ],
        notes: ["الرمز واحد لكلا الوالدين."],
      },
      {
        id: "S2.9",
        q: "كيف أعطي <الطالبة|الطالب> رمز الدخول؟",
        showMe: true,
        more: true,
        perm: "codes",
        feat: "studentLogin",
        steps: [
          { text: "[افتحي|افتح] «رمز دخول <الطالبة|الطالب>» أسفل الصفحة.", target: "c.studentCode", kind: "press" },
          { text: "[اضغطي|اضغط] «إنشاء رمز <للطالبة|للطالب>»." },
          { text: "[أرسلي|أرسل] الرمز والرابط إلي<ها|ه>." },
        ],
      },
      {
        id: "S2.10",
        q: "أين حفظ البيت والواجبات وجدول المتابعة؟",
        showMe: false,
        more: true,
        show: (f) => f.features.studentLogin && (f.features.homeLog || f.features.assignments || f.features.tracker),
        steps: [{ text: "أسفل الصفحة، كلٌّ في قسم يُفتح بالضغط على عنوانه. ويظهر منها ما فُعّل في الدورة." }],
      },
    ],
  },
  {
    id: "s.new",
    title: "إضافة يدوية",
    questions: [
      {
        id: "S3.1",
        q: "كيف أضيف <طالبة|طالبًا>؟",
        showMe: true,
        perm: "add",
        steps: [
          { text: "[اكتبي|اكتب] الاسم والعمر، [واختاري|واختر] المجموعة.", target: "c.newFields" },
          { text: "[اختاري|اختر] الحفظ السابق إن وُجد." },
          { text: "[اختاري|اختر] الخطة: قالبًا جاهزًا، ثم [عدّلي|عدّل] السور إن [شئتِ|شئت].", target: "plan.templates" },
          { text: "[اضغطي|اضغط] زر الحفظ أسفل النموذج.", target: "c.newSave", kind: "save" },
        ],
      },
    ],
  },
  {
    id: "s.import",
    title: "استيراد من Excel",
    questions: [
      {
        id: "S4.1",
        q: "كيف أستورد قائمة من Excel؟",
        showMe: true,
        perm: "add",
        steps: [
          {
            text: "[نزّلي|نزّل] القالب من «١. تحميل القالب».",
            target: "c.importTemplate",
            missing: "لا توجد مجموعات متاحة بعد، فلا قالب.",
          },
          { text: "[اكتبي|اكتب] الأسماء في الملف، [واحفظيه|واحفظه]." },
          { text: "[اختاري|اختر] الملف في «٢. رفع الملف بعد تعبئته»، ثم [اضغطي|اضغط] «استيراد».", target: "c.importUpload" },
        ],
        notes: ["تُستورد الأسطر الصحيحة فقط، ويظهر سبب كل سطر تُجوهل."],
      },
    ],
  },
  {
    id: "s.archive",
    title: "الأرشيف",
    questions: [
      {
        id: "S5.1",
        q: "كيف أستعيد من الأرشيف؟",
        showMe: true,
        adminOnly: true,
        steps: [
          {
            text: "[اضغطي|اضغط] «استعادة» بجانب الاسم.",
            target: "c.archiveList",
            missing: "لا يوجد أحد في الأرشيف.",
          },
        ],
      },
      {
        id: "S5.2",
        q: "ما الفرق بين الأرشفة والحذف النهائي؟",
        showMe: false,
        adminOnly: true,
        steps: [
          { text: "الأرشفة تُخفي الاسم من القائمة وتُبقي السجل كله، [وتستطيعين|وتستطيع] الاستعادة متى [شئتِ|شئت]." },
          { text: "الحذف النهائي يمحو السجل كله، ولا يمكن التراجع عنه، ويُطلب فيه كتابة الاسم للتأكيد." },
        ],
      },
    ],
  },
  {
    id: "s.offline",
    title: "التسميع بدون إنترنت",
    questions: [
      {
        id: "S6.1",
        q: "كيف أسجّل حلقة دون إنترنت؟",
        showMe: true,
        perm: "offline",
        steps: [
          { text: "[اختاري|اختر] المجموعة.", target: "c.offlineDownload", missing: "لا توجد مجموعات متاحة بعد." },
          { text: "[اضغطي|اضغط] «⬇ تنزيل الملف»." },
          { text: "في الحلقة [اكتبي|اكتب] الحضور والتسميع والنقاط في الملف." },
          { text: "بعدها [ارفعي|ارفع] الملف في «٢. رفع الملف بعد تعبئته».", target: "c.offlineUpload" },
          { text: "[راجعي|راجع] المعاينة." },
          { text: "[اضغطي|اضغط] «حفظ»." },
        ],
        notes: ["لا يُحفظ شيء قبل الضغط على «حفظ»."],
      },
    ],
  },
  {
    id: "s.parentCodes",
    title: "رموز أولياء الأمور",
    questions: [
      {
        id: "S7.1",
        q: "كيف أنشئ الرموز للجميع؟",
        showMe: true,
        adminOnly: true,
        steps: [{ text: "[اضغطي|اضغط] «إنشاء رموز لجميع الطلاب الذين لا يملكون رمزًا».", target: "c.codesCreate", kind: "save" }],
        notes: ["رمز وليّ الأمر واحد لكلا الوالدين، ويُجدَّد أو يُلغى من صفحة <الطالبة|الطالب>."],
      },
      {
        id: "S7.2",
        q: "كيف أطبع القائمة؟",
        showMe: true,
        adminOnly: true,
        steps: [{ text: "[اضغطي|اضغط] «🖨️ طباعة القائمة».", target: "c.codesPrint" }],
      },
    ],
  },
  {
    id: "s.studentCodes",
    title: "رموز <الطالبات|الطلاب>",
    questions: [
      {
        id: "S7.3",
        q: "كيف أنشئ الرموز للجميع؟",
        showMe: true,
        perm: "codes",
        feat: "studentLogin",
        steps: [{ text: "[اضغطي|اضغط] «إنشاء رموز لجميع الطلاب الذين لا يملكون رمزًا».", target: "c.codesCreate", kind: "save" }],
      },
      {
        id: "S7.4",
        q: "كيف أطبع القائمة؟",
        showMe: true,
        perm: "codes",
        feat: "studentLogin",
        steps: [{ text: "[اضغطي|اضغط] «🖨️ طباعة القائمة».", target: "c.codesPrint" }],
      },
    ],
  },
  {
    id: "s.leaderboard",
    title: "لوحة الإنجاز",
    questions: [
      {
        id: "S8.1",
        q: "كيف أرتّب اللوحة؟",
        showMe: true,
        steps: [
          { text: "[اختاري|اختر] عند «الترتيب حسب»: «الصفحات» أو «النقاط».", target: "c.lbSort" },
          { text: "[اختاري|اختر] المجموعات عند «المجموعات:».", target: "c.lbGroups" },
        ],
        notes: ["تظهر هذه اللوحة لكل المعلمين معًا."],
      },
      {
        id: "S8.2",
        q: "هل يراها <الطالبات|الطلاب> والأهالي؟",
        showMe: false,
        adminOnly: true,
        steps: [
          { text: "<الطالبات|الطلاب>: حين تكون «لوحة الإنجاز للطلاب» مفعّلة في بطاقة «دخول الطلاب»." },
          { text: "والأهالي وغيرهم: برمز من بطاقة «رمز لوحة الإنجاز العامة» في «الإعدادات»." },
        ],
      },
    ],
  },
  {
    id: "s.assignments",
    title: "الواجبات",
    welcome: "هنا [تكلّفين|تكلّف] مجموعة أو <طالبات|طلابًا> بواجب، [وترين|وترى] من أنجزه.",
    questions: [
      {
        id: "S9.1",
        q: "كيف أضيف واجبًا؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «+ واجب جديد».", target: "c.assignNew", kind: "press" },
          { text: "[اكتبي|اكتب] العنوان، [واختاري|واختر] النوع ولمن الواجب." },
          { text: "[اضغطي|اضغط] «حفظ»." },
        ],
        notes: ["واجب الحفظ يُضاف مقطعًا في «حفظي في البيت» لدى كل من كُلّف به."],
      },
      {
        id: "S9.2",
        q: "كيف أعرف من أنجز الواجب؟",
        showMe: true,
        steps: [
          {
            text: "تحت كل واجب: من أنجزه، ومن «لم يُعلَّم بعد».",
            target: "c.assignList",
            missing: "لا توجد واجبات بعد. [أضيفي|أضف] واجبًا من «+ واجب جديد».",
          },
        ],
      },
      {
        id: "S9.3",
        q: "كيف أعدّل واجبًا أو أحذفه؟",
        showMe: true,
        steps: [
          {
            text: "[اضغطي|اضغط] «تعديل» أو «حذف» تحت الواجب.",
            target: "c.assignList",
            missing: "لا توجد واجبات بعد.",
          },
        ],
        notes: ["تبقى مقاطع الحفظ التي بدأ التدريب عليها."],
      },
      {
        id: "S9.4",
        q: "كيف أعرض واجبات مجموعة واحدة؟",
        showMe: true,
        more: true,
        show: (f) => (f.role === "admin" ? f.groups : f.ownGroups || f.groups) > 1,
        steps: [{ text: "[اضغطي|اضغط] اسم المجموعة أعلى القائمة.", target: "c.assignFilter" }],
      },
    ],
  },
  {
    id: "s.tracker",
    title: "جدول المتابعة",
    welcome: "هنا بنود جدول المتابعة لكل مجموعة، ومتابعة أسبوعها.",
    questions: [
      {
        id: "S10.1",
        q: "كيف أضيف بندًا؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «+ بند جديد».", target: "c.trNewItem", kind: "press" },
          { text: "[اكتبي|اكتب] اسم البند، [واختاري|واختر] الدرجة والأيام ولمن البند." },
          { text: "[اضغطي|اضغط] «حفظ»." },
        ],
      },
      {
        id: "S10.2",
        q: "كيف أعتمد بنود <الطالبات|الطلاب> الخاصة؟",
        showMe: true,
        steps: [
          {
            text: "تظهر في «بانتظار الاعتماد» أعلى الصفحة.",
            target: "c.trQueue",
            missing: "لا بنود بانتظار الاعتماد الآن.",
          },
          { text: "[اختاري|اختر] الدرجة." },
          { text: "[اضغطي|اضغط] «اعتماد بدرجة …» أو «عدم الاعتماد»." },
        ],
      },
      {
        id: "S10.3",
        q: "كيف أتابع المجموعة هذا الأسبوع؟",
        showMe: true,
        steps: [
          { text: "في «متابعة الأسبوع» درجة كل <طالبة|طالب> في كل يوم.", target: "c.trWeek" },
          { text: "[اضغطي|اضغط] «الأسبوع الماضي» للمقارنة." },
          { text: "[اضغطي|اضغط] على اسم لفتح صفحت<ها|ه>." },
        ],
      },
      {
        id: "S10.4",
        q: "كيف أعدّل بندًا أو أؤرشفه؟",
        showMe: true,
        steps: [
          {
            text: "[اضغطي|اضغط] «تعديل» أو «أرشفة» تحت البند.",
            target: "c.trItems",
            missing: "لا توجد بنود بعد. [أضيفي|أضف] بندًا من «+ بند جديد».",
          },
        ],
        notes: ["الأرشفة توقف احتسابه من اليوم، وتبقى درجات الأيام السابقة."],
      },
      {
        id: "S10.5",
        q: "كيف أرتّب البنود وأوقاتها؟",
        showMe: true,
        feat: "agenda",
        steps: [
          {
            text: "[اضغطي|اضغط] «ترتيب البنود».",
            target: "c.trOrder",
            kind: "press",
            missing: "يظهر «ترتيب البنود» حين يكون في المجموعة بندان على الأقل.",
          },
          { text: "[اسحبي|اسحب] البند من المقبض ⠿، أو [استعملي|استعمل] ▲ ▼." },
          { text: "[احفظي|احفظ] الترتيب." },
          { text: "ووقت كل بند في نموذجه، عند الإضافة أو «تعديل»." },
        ],
      },
      {
        id: "S10.6",
        q: "كيف أنتقل إلى مجموعة أخرى؟",
        showMe: true,
        more: true,
        show: (f) => (f.role === "admin" ? f.groups : f.ownGroups || f.groups) > 1,
        steps: [{ text: "[اضغطي|اضغط] اسم المجموعة أعلى الصفحة.", target: "c.trGroups" }],
      },
    ],
  },
  {
    id: "s.reports",
    title: "التقارير",
    questions: [
      {
        id: "S11.1",
        q: "كيف أختار ما يظهر في التقرير؟",
        showMe: true,
        steps: [{ text: "[اختاري|اختر] النطاق والمجموعة، ثم فترة جاهزة أو تاريخين.", target: "c.repFilters" }],
      },
      {
        id: "S11.2",
        q: "كيف أنزّل التقرير؟",
        showMe: true,
        steps: [{ text: "[اضغطي|اضغط] «⬇️ تنزيل Excel» أو «🖨️ تنزيل PDF».", target: "c.repDownload", missing: "لا توجد بيانات ضمن هذا النطاق والفترة." }],
      },
    ],
  },
  {
    id: "s.calendar",
    title: "التقويم",
    questions: [
      {
        id: "S12.1",
        q: "كيف أضيف فعالية؟",
        showMe: true,
        perm: "calendarManage",
        steps: [
          { text: "[اضغطي|اضغط] «+ إضافة فعالية».", target: "calendar.add", kind: "press" },
          { text: "[اكتبي|اكتب] العنوان، [واختاري|واختر] التاريخ." },
          { text: "[اضغطي|اضغط] «حفظ»." },
        ],
      },
      {
        id: "S12.2",
        q: "كيف أضيف مناسبة اختيارية؟",
        showMe: true,
        perm: "calendarManage",
        steps: [{ text: "في «المناسبات الاختيارية» [اختاري|اختر] ما [تريدينه|تريده] للدورة.", target: "calendar.optional" }],
        notes: ["المناسبات الأساسية تظهر دائمًا: رمضان، والعيدان، ويوم عرفة."],
      },
      {
        id: "S12.3",
        q: "كيف أعدّل موعد مناسبة بحسب رؤية الهلال؟",
        showMe: true,
        adminOnly: true,
        steps: [
          { text: "في «القادم» [اضغطي|اضغط] «تعديل الموعد بحسب رؤية الهلال» تحت المناسبة.", target: "calendar.adjust", missing: "لا مناسبات قادمة يمكن تعديلها الآن." },
          { text: "[اختاري|اختر] تقديم يوم أو يومين، أو تأخير يوم أو يومين." },
        ],
      },
      {
        id: "S12.4",
        q: "كيف أنتقل بين الأشهر؟",
        showMe: true,
        more: true,
        steps: [{ text: "[اضغطي|اضغط] السهمين بجانب اسم الشهر.", target: "calendar.nav" }],
      },
    ],
  },
  {
    id: "s.resources",
    title: "بنك الوسائل",
    questions: [
      {
        id: "S13.1",
        q: "كيف أبحث عن وسيلة؟",
        showMe: true,
        steps: [{ text: "[اكتبي|اكتب] في خانة البحث، أو [اختاري|اختر] النوع والعمر.", target: "c.resSearch" }],
        notes: ["البنك مشترك بين كل الدورات، ولا يظهر فيه اسم من أضاف الوسيلة ولا دورته."],
      },
      {
        id: "S13.2",
        q: "كيف أضيف وسيلة؟",
        showMe: true,
        steps: [{ text: "[اضغطي|اضغط] «+ إضافة وسيلة».", target: "c.resAdd", kind: "press" }],
      },
      {
        id: "S13.3",
        q: "أين الوسائل التي أضفتُها؟",
        showMe: true,
        steps: [{ text: "[اضغطي|اضغط] «وسائلي».", target: "c.resMine" }],
      },
      {
        id: "S13.4",
        q: "ما «⚑ إبلاغ»؟",
        showMe: false,
        more: true,
        steps: [{ text: "للإبلاغ عن وسيلة غير مناسبة، لتُراجَع." }],
      },
    ],
  },
  {
    id: "s.settings",
    title: "الإعدادات",
    welcome: "هنا إعدادات الدورة. كل بطاقة تُفتح بالضغط على عنوانها، وكل اختيار يُحفظ فورًا.",
    questions: [
      {
        id: "S14.1",
        q: "كيف يدخل المعلمون؟",
        showMe: true,
        adminOnly: true,
        steps: [
          { text: "[افتحي|افتح] «رمز الدورة للمعلمين».", target: "c.card.code", kind: "press" },
          { text: "[اضغطي|اضغط] «نسخ الرمز 📋»." },
          { text: "[أرسلي|أرسل] الرمز إلى المعلمين." },
          { text: "يدخل المعلم باسمه وهذا الرمز من صفحة الدخول." },
        ],
      },
      {
        id: "S14.2",
        q: "كيف أحدّد ما يستطيعه المعلمون؟",
        showMe: true,
        adminOnly: true,
        steps: [
          { text: "[افتحي|افتح] «صلاحيات المعلمين».", target: "c.card.perms", kind: "press" },
          { text: "[اختاري|اختر] لكل صلاحية: «{supOnly}» أو «كل المعلمين»." },
          { text: "وعند «رؤية الطلاب» [اختاري|اختر] «تخصيص لكل معلم» ليرى كلٌّ مجموعته فقط." },
        ],
      },
      {
        id: "S14.3",
        q: "كيف أضيف مجموعة أو أغيّر اسمها؟",
        showMe: true,
        adminOnly: true,
        steps: [
          { text: "[افتحي|افتح] «مجموعات الدورة».", target: "c.card.groups", kind: "press" },
          { text: "[اكتبي|اكتب] اسم المجموعة الجديدة، ثم [اضغطي|اضغط] «إضافة مجموعة»." },
          { text: "لتغيير اسم مجموعة [اكتبي|اكتب] الاسم الجديد مكانه." },
          { text: "ولتغيير نوعها [اختاري|اختر] «بنات» أو «بنين» أو «مختلطة»." },
        ],
      },
      {
        id: "S14.4",
        q: "كيف أفعّل دخول <الطالبات|الطلاب>؟",
        showMe: true,
        adminOnly: true,
        steps: [
          { text: "[افتحي|افتح] «دخول الطلاب».", target: "c.card.studentLogin", kind: "press" },
          { text: "[اضغطي|اضغط] «مفعّل» عند «دخول الطلاب»." },
          { text: "ثم [اختاري|اختر] ما يظهر لهم: «حفظي في البيت»، و«الواجبات»، و«جدول المتابعة»، وغيرها." },
        ],
        notes: ["بعدها [أعطي|أعطِ] كلًّا رمز دخول من صفحت<ها|ه>، أو من «الرموز» في «قائمة الطلاب»."],
      },
      {
        id: "S14.5",
        q: "كيف أغيّر أنشطة النقاط؟",
        showMe: true,
        adminOnly: true,
        steps: [
          { text: "[افتحي|افتح] «نظام النقاط».", target: "c.card.points", kind: "press" },
          { text: "[غيّري|غيّر] اسم النشاط أو قيمته أو نوعه، أو [أضيفي|أضف] نشاطًا جديدًا." },
        ],
      },
      {
        id: "S14.6",
        q: "كيف أتيح لوحة الإنجاز للأهالي؟",
        showMe: true,
        more: true,
        adminOnly: true,
        steps: [
          { text: "[افتحي|افتح] «رمز لوحة الإنجاز العامة».", target: "c.card.board", kind: "press" },
          { text: "[اضغطي|اضغط] «إنشاء رمز للوحة الإنجاز»." },
          { text: "[أرسلي|أرسل] الرمز والرابط لمن [تريدين|تريد]." },
        ],
      },
      {
        id: "S14.7",
        q: "كيف أغيّر توقيت الدورة؟",
        showMe: true,
        more: true,
        adminOnly: true,
        steps: [
          { text: "[افتحي|افتح] «التوقيت».", target: "c.card.timezone", kind: "press" },
          { text: "[اختاري|اختر] المنطقة." },
          { text: "[اضغطي|اضغط] «حفظ التوقيت»." },
        ],
      },
      {
        id: "S14.8",
        q: "ما «تذكير المراجعة»؟",
        showMe: true,
        more: true,
        adminOnly: true,
        steps: [
          { text: "[افتحي|افتح] «تذكير المراجعة».", target: "c.card.review", kind: "press" },
          { text: "[اضغطي|اضغط] «مفعّل»، [واكتبي|واكتب] عدد الأيام." },
          { text: "تظهر 🔁 على بطاقة كل من مضت هذه المدة على سورة أتمّها دون مراجعة." },
        ],
      },
      {
        id: "S14.9",
        q: "ما «الأسابيع المتتالية 🔥»؟",
        showMe: true,
        more: true,
        adminOnly: true,
        steps: [
          { text: "[افتحي|افتح] «الأسابيع المتتالية 🔥».", target: "c.card.streak", kind: "press" },
          { text: "[اختاري|اختر] متى يُحتسب الأسبوع: «بالحضور» أو «بالتسميع»." },
        ],
      },
      {
        id: "S14.10",
        q: "كيف أفعّل التقويم؟",
        showMe: true,
        more: true,
        adminOnly: true,
        steps: [
          { text: "[افتحي|افتح] «التقويم الهجري».", target: "c.card.calendar", kind: "press" },
          { text: "[اضغطي|اضغط] «مفعّل». تظهر صفحة «التقويم» للمعلمين." },
        ],
      },
      {
        id: "S14.11",
        q: "كيف أجمع معلومات إضافية عن كل <طالبة|طالب>؟",
        showMe: true,
        more: true,
        adminOnly: true,
        steps: [
          { text: "[افتحي|افتح] «معلومات إضافية».", target: "c.card.info", kind: "press" },
          { text: "[اضغطي|اضغط] «مفعّل»، ثم [اختاري|اختر] الحقول ومن يراها." },
        ],
      },
    ],
  },
];
