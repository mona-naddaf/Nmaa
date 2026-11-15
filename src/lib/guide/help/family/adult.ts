import type { FamilyRawPage, ChildSwitch } from "./types";

// «؟» for an adult on a child's pages, word for word from the family guide's
// review page (section ٥, approved 2026-11-15): the adult's gender ([f|m]),
// the child's (<f|m>, {name}). role "edit" needs edit rights (view-only:
// under «أسئلة أخرى» with U2); `feat` the child's switch (off: «تفعيل الآن»
// for an adult with edit rights, U4 for the others). Edit the texts only
// with Mona.

export const ADULT_HELP: FamilyRawPage[] = [
  {
    id: "a.home",
    title: "<صفحتها|صفحته>",
    questions: [
      {
        id: "A1.1",
        role: "edit",
        q: "كيف أسمّع لـ{name} وأحدّد <أخطاءها|أخطاءه>؟",
        showMe: true,
        steps: [
          { text: "[انزلي|انزل] إلى «التسميع مع {name}».", target: "record.section", optional: true },
          { text: "[اختاري|اختر] نوع الجلسة، ثم «السورة» و«من آية» و«إلى آية».", target: "record.type", optional: true },
          { text: "[اضغطي|اضغط] «🔖 تحديد الأخطاء على مستوى الكلمة (اختياري)».", target: "record.flagger", kind: "press", optional: true },
          { text: "[اضغطي|اضغط] على الكلمة التي <أخطأت|أخطأ> فيها {name}، ثم [اختاري|اختر] نوع الخطأ." },
          { text: "[اضغطي|اضغط] «حفظ الجلسة». تظهر الكلمات في «🔖 كلمات تحتاج مراجعة».", target: "record.save", kind: "save", optional: true },
        ],
      },
      {
        id: "A1.2",
        role: "view",
        q: "ماذا تعني الأرقام في أعلى الصفحة؟",
        showMe: true,
        steps: [
          { text: "«موضع {name} الحالي»: آخر آية <سجّلتها|سجّلها> «حفظًا جديدًا».", target: "home.position", optional: true },
          { text: "وتحته <هدفها|هدفه> والمطلوب كل يوم، إن كان <لها|له> هدف." },
          { text: "الأشرطة تبيّن تقدّم {name} في السورة والجزء والخطة.", target: "home.bars", optional: true },
        ],
      },
      {
        id: "A1.3",
        role: "view",
        q: "من سجّل كل جلسة؟",
        showMe: true,
        steps: [
          { text: "[افتحي|افتح] «سجل الجلسات».", target: "history.section", kind: "press", missing: "لا توجد جلسات بعد." },
          { text: "تحت كل جلسة من سجّلها: «<سجّلتها|سجّلها> {name}»، أو اسم البالغ الذي سمّع <معها|معه>." },
          { text: "«تقييم ذاتي»: تقييم {name} <لنفسها|لنفسه>." },
        ],
      },
      {
        id: "A1.4",
        role: "edit",
        q: "كيف أعلّم كلمة <أتقنتها|أتقنها> {name}؟",
        showMe: true,
        steps: [
          { text: "[افتحي|افتح] «🔖 كلمات تحتاج مراجعة».", target: "mistakes.section", kind: "press", missing: "لا توجد كلمات تحتاج مراجعة الآن." },
          { text: "[اضغطي|اضغط] «تم الإتقان ✓» بجانب الكلمة." },
        ],
      },
      {
        id: "A1.5",
        role: "view",
        feat: "streak",
        q: "ما معنى 🔥 وأيام الأسبوع؟",
        showMe: true,
        steps: [
          { text: "🔥 عدد أيام الالتزام المتتالية التي <سجّلت|سجّل> فيها {name} جلسة.", target: "home.streak", optional: true },
          { text: "تحته أيام هذا الأسبوع: ✓ يوم <سجّلت|سجّل> فيه، و✗ يوم <فاتها|فاته>، و— يوم راحة." },
        ],
      },
      {
        id: "A1.6",
        role: "edit",
        more: true,
        q: "كيف أغيّر تقييم جلسة؟",
        showMe: true,
        steps: [{ text: "[افتحي|افتح] «سجل الجلسات».", target: "history.section", kind: "press", missing: "لا توجد جلسات بعد." }, { text: "[اختاري|اختر] «التقييم» تحت الجلسة. يُحفظ فورًا." }],
      },
      {
        id: "A1.7",
        role: "edit",
        more: true,
        q: "كيف أحذف جلسة؟",
        showMe: true,
        steps: [{ text: "[افتحي|افتح] «سجل الجلسات».", target: "history.section", kind: "press", missing: "لا توجد جلسات بعد." }, { text: "[اضغطي|اضغط] «حذف» تحت الجلسة، ثم «تأكيد الحذف»." }],
      },
      {
        id: "A1.8",
        role: "edit",
        more: true,
        q: "كيف أفعّل ميزة لـ{name}؟",
        showMe: true,
        steps: [{ text: "[اضغطي|اضغط] «إعدادات {name}».", target: "child.settingsTab", kind: "press", optional: true }, { text: "[ضعي|ضع] علامة على الميزة. تُحفظ فورًا.", page: "a.settings" }],
      },
      {
        id: "A1.9",
        role: "edit",
        more: true,
        q: "كيف <تدخل|يدخل> {name} إلى <صفحتها|صفحته>؟",
        showMe: true,
        steps: [
          // «العائلة ←» leaves these pages (and their help): it is only shown
          { text: "[اضغطي|اضغط] «العائلة ←» أعلى الصفحة.", target: "child.familyLink", optional: true },
          { text: "في قسم «الأطفال» رمز الدخول بجانب اسم {name}. [اضغطي|اضغط] «نسخ الرمز»." },
          { text: "<تدخل|يدخل> {name} من بطاقة «العائلة» في الصفحة الرئيسية، ثم «طفل / طفلة»، <باسمها ورمزها|باسمه ورمزه>." },
        ],
      },
      {
        id: "A1.10",
        role: "edit",
        more: true,
        feat: "highlight",
        when: "highlight",
        q: "كيف أظلّل مقطعًا لـ{name}؟",
        showMe: true,
        steps: [
          { text: "[افتحي|افتح] «🔖 تحديد الأخطاء على مستوى الكلمة (اختياري)».", target: "record.flagger", kind: "press", optional: true },
          { text: "[اضغطي|اضغط] «تظليل» فوق الآيات.", target: "highlight.button", via: ["record.flagger"] },
          { text: "[اضغطي|اضغط] أول كلمة في المقطع، ثم آخر كلمة." },
          { text: "[اضغطي|اضغط] «إنهاء التظليل» حين [تنتهين|تنتهي]." },
        ],
        notes: ["<ترى|يرى> {name} ما [تظلّلينه|تظلّله] في <صفحاتها|صفحاته>."],
      },
    ],
  },
  {
    id: "a.tracker",
    title: "جدول المتابعة",
    questions: [
      {
        id: "A2.1",
        role: "edit",
        q: "كيف أضيف بندًا إلى جدول {name}؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «⚙ البنود»، ثم «إدارة البنود».", target: "tracker.menu.items", kind: "press", via: ["tracker.menu"], optional: true },
          { text: "[اضغطي|اضغط] «+ بند جديد».", target: "tracker.newItem", kind: "press", optional: true },
          { text: "[اكتبي|اكتب] «اسم البند»، و[اختاري|اختر] «الدرجة» و«الأيام»." },
          { text: "[اضغطي|اضغط] «إضافة البند»." },
        ],
        notes: ["<تضع|يضع> {name} على البند ✓، ولا <تغيّره|يغيّره>.", "إن كان <لها|له> إخوة [فيمكنكِ|فيمكنك] اختيارهم في النموذج نفسه ليُضاف البند لهم أيضًا."],
      },
      {
        id: "A2.2",
        role: "edit",
        q: "كيف أعلّم بندًا <أنجزته|أنجزه> {name}؟",
        showMe: true,
        steps: [{ text: "[اضغطي|اضغط] على البند في جدول اليوم، فتظهر عليه ✓.", target: "tracker.sheet", optional: true }, { text: "للتراجع [اضغطي|اضغط] عليه مرة أخرى." }],
      },
      {
        id: "A2.3",
        role: "edit",
        q: "كيف أنسخ جدول {name} إلى <إخوتها|إخوته>؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «⚙ البنود»، ثم «إدارة البنود».", target: "tracker.menu.items", kind: "press", via: ["tracker.menu"], optional: true },
          { text: "[اضغطي|اضغط] «نسخ الجدول إلى…».", target: "tracker.copy", kind: "press", optional: true },
          { text: "[ضعي|ضع] علامة على الأطفال، ثم [اضغطي|اضغط] «نسخ»." },
        ],
        notes: ["تُنسخ البنود الحالية فقط، وبعد النسخ يصبح كل بند مستقلًّا."],
      },
      {
        id: "A2.4",
        role: "edit",
        q: "كيف أعدّل بندًا أو أحذفه؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «⚙ البنود»، ثم «إدارة البنود».", target: "tracker.menu.items", kind: "press", via: ["tracker.menu"], optional: true },
          { text: "[اضغطي|اضغط] ✎ بجانب البند لتعديله، أو 🗑 لحذفه.", target: "tracker.itemRow", missing: "لا بنود بعد." },
          { text: "عند الحذف [اضغطي|اضغط] «نعم، حذف». تبقى درجات الأيام السابقة." },
        ],
      },
      {
        id: "A2.5",
        role: "view",
        feat: "summary",
        q: "كيف أرى التزام {name} في الأسبوع والشهر؟",
        showMe: true,
        steps: [{ text: "[اضغطي|اضغط] «📊 المحصّلات».", target: "tracker.summary", kind: "press", optional: true }],
      },
      {
        id: "A2.6",
        role: "view",
        more: true,
        q: "ما معنى «من …» تحت البند؟",
        showMe: true,
        steps: [{ text: "البند الذي تحته «من {founder}» أضافته {founder}.", target: "tracker.sheet", optional: true }, { text: "والبند الذي ليس تحته شيء <أضافته|أضافه> {name} <بنفسها|بنفسه>." }],
      },
      {
        id: "A2.7",
        role: "edit",
        more: true,
        feat: "agenda",
        q: "كيف أعطي كل بند وقتًا؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] ⏱ بجانب البند.", target: "agenda.timeBtn", kind: "press", via: ["tracker.back"], missing: "لا بنود لليوم." },
          { text: "[اختاري|اختر] «وقت محدّد» أو «بالنسبة إلى صلاة»، ثم [حدّدي|حدّد] الوقت." },
          { text: "[اضغطي|اضغط] «حفظ الوقت»." },
        ],
        notes: ["أوقات الصلاة تحتاج مدينة العائلة: «عائلتي» ← «المدينة (لمواقيت الصلاة)»."],
      },
      {
        id: "A2.8",
        role: "edit",
        more: true,
        feat: "agenda",
        q: "كيف أرتّب البنود؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «⚙ البنود»، ثم «ترتيب البنود».", target: "tracker.menu.order", kind: "press", via: ["tracker.menu"], optional: true },
          { text: "[اسحبي|اسحب] البند من المقبض ⠿، أو [استعملي|استعمل] السهمين ▲ ▼." },
          { text: "[اضغطي|اضغط] «حفظ الترتيب»." },
        ],
      },
    ],
  },
  {
    id: "a.summary",
    title: "المحصّلات",
    questions: [
      {
        id: "A3.1",
        role: "view",
        q: "كيف أختار الفترة؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «أسبوع» أو «شهر» أو «ربع سنة» أو «نصف سنة» أو «سنة».", target: "summary.periods", optional: true },
          { text: "للفترة السابقة [اضغطي|اضغط] «→ السابق»، وللتالية «التالي ←».", target: "summary.nav", optional: true },
        ],
      },
      {
        id: "A3.2",
        role: "view",
        q: "ماذا تعني الدائرة والمربّعات؟",
        showMe: true,
        steps: [
          { text: "الدائرة نسبة التزام {name} في الفترة كلها.", target: "summary.ring", optional: true },
          { text: "كل مربّع يوم، وكلما غمق لونه زاد الالتزام. والنجمة ✦ يوم مكتمل.", target: "summary.mosaic", optional: true },
          { text: "[اضغطي|اضغط] على يوم [لتري|لترى] بنوده." },
        ],
      },
      {
        id: "A3.3",
        role: "view",
        q: "كيف أعرف التزام {name} في كل بند؟",
        showMe: true,
        steps: [
          { text: "[انزلي|انزل] إلى «الالتزام في كل بند».", target: "summary.items", optional: true },
          { text: "[اضغطي|اضغط] على بند [لتري|لترى] الالتزام فيه وحده." },
          { text: "للعودة [اضغطي|اضغط] «عرض الكل»." },
        ],
      },
      { id: "A3.4", role: "view", q: "كيف أعود إلى الجدول؟", showMe: true, steps: [{ text: "[اضغطي|اضغط] «→ جدول المتابعة».", target: "summary.back", kind: "press", optional: true }] },
    ],
  },
  {
    id: "a.homelog",
    title: "<حفظها|حفظه> في البيت",
    questions: [
      {
        id: "A4.1",
        role: "edit",
        q: "كيف أبدأ مقطعًا جديدًا لـ{name}؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «+ مقطع جديد».", target: "homeLog.new", kind: "press", optional: true },
          { text: "[اختاري|اختر] «السورة»، ثم «من الآية» و«إلى الآية»." },
          { text: "[اضغطي|اضغط] زرّ البدء تحتها." },
        ],
      },
      {
        id: "A4.2",
        role: "edit",
        q: "كيف أغيّر عدد المرات لكل مقطع؟",
        showMe: true,
        steps: [
          { text: "عدد المرات: كم مرة <تسمع|يسمع> {name} المقطع <وتكرّره|ويكرّره> <وتسمّعه|ويسمّعه>." },
          { text: "[اضغطي|اضغط] «تعديل» في قسم الأهداف.", target: "homeLog.targets", kind: "press", optional: true },
          { text: "[غيّري|غيّر] الأعداد، ثم [اضغطي|اضغط] «حفظ الأهداف»." },
        ],
      },
      {
        id: "A4.3",
        role: "view",
        q: "ما معنى «سماع» و«تكرار» و«تسميع لأحد»؟",
        showMe: false,
        steps: [
          { text: "🎧 سماع: <استمعت|استمع> إلى قارئ يقرأ المقطع." },
          { text: "🔁 تكرار: <قرأته|قرأه> من المصحف أو من <حفظها|حفظه>." },
          { text: "🗣️ تسميع لأحد: <سمّعته|سمّعه> لأحد يصحّح <لها|له>." },
        ],
      },
      {
        id: "A4.4",
        role: "view",
        q: "هل يُقدّم هذا موضع {name} في الخطة؟",
        showMe: false,
        steps: [{ text: "لا. هذه الصفحة للتدريب فقط." }, { text: "يتقدّم الموضع بجلسة «حفظ جديد» في «<صفحتها|صفحته>»." }],
      },
      {
        id: "A4.5",
        role: "view",
        more: true,
        q: "أين أجد المقاطع التي <أتمّتها|أتمّها>؟",
        showMe: true,
        steps: [{ text: "في «مقاطع سابقة» أسفل الصفحة.", target: "homeLog.past", missing: "لا توجد مقاطع سابقة بعد." }],
      },
    ],
  },
  {
    id: "a.segment",
    title: "صفحة المقطع",
    questions: [
      {
        id: "A5.1",
        role: "edit",
        q: "كيف أسجّل مرة سماع أو تكرار أو تسميع مع {name}؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] + تحت «سماع» أو «تكرار» أو «تسميع لأحد».", target: "practice.counters", optional: true },
          { text: "إن [ضغطتِ|ضغطتَ] خطأً [فاضغطي|فاضغط] «↶ تراجع»." },
        ],
      },
      {
        id: "A5.2",
        role: "edit",
        q: "كيف <تتدرّب|يتدرّب> على آية واحدة؟",
        showMe: true,
        steps: [{ text: "[انزلي|انزل] إلى قائمة الآيات.", target: "practice.ayat", optional: true }, { text: "[اضغطي|اضغط] + بجانب الآية." }],
      },
      {
        id: "A5.3",
        role: "edit",
        q: "كيف أنهي المقطع؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «✓ أتممتُ هذا المقطع» أسفل الصفحة.", target: "practice.finish", kind: "save", optional: true },
          { text: "[اضغطي|اضغط] «نعم». ينتقل المقطع إلى «مقاطع سابقة»." },
        ],
      },
      { id: "A5.4", role: "view", q: "كيف أعود إلى قائمة المقاطع؟", showMe: true, steps: [{ text: "[اضغطي|اضغط] «→ مقاطعي» أعلى الصفحة.", target: "practice.back", kind: "press", optional: true }] },
      {
        id: "A5.5",
        role: "edit",
        more: true,
        feat: "highlight",
        when: "highlight",
        q: "كيف أظلّل مقطعًا لـ{name}؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «تظليل» فوق الآيات.", target: "highlight.button" },
          { text: "[اضغطي|اضغط] أول كلمة في المقطع، ثم آخر كلمة." },
          { text: "[اضغطي|اضغط] «إنهاء التظليل» حين [تنتهين|تنتهي]." },
        ],
        notes: ["<ترى|يرى> {name} ما [تظلّلينه|تظلّله] في <صفحاتها|صفحاته>."],
      },
    ],
  },
  {
    id: "a.plan",
    title: "<خطتها|خطته>",
    questions: [
      {
        id: "A6.0",
        role: "view",
        q: "أين <وصلت|وصل> {name} في <خطتها|خطته>؟",
        showMe: false,
        steps: [{ text: "يظهر الموضع في أعلى «<صفحتها|صفحته>»، والسور بالترتيب في «ترتيب الخطة»." }],
      },
      {
        id: "A6.1",
        role: "edit",
        q: "كيف أغيّر خطة {name}؟",
        showMe: true,
        steps: [
          { text: "في «اختيار قالب خطة الحفظ» [اضغطي|اضغط] على القالب.", target: "plan.templates", optional: true },
          { text: "[راجعي|راجع] السور في «ترتيب الخطة».", target: "plan.list", optional: true },
          { text: "[اضغطي|اضغط] «حفظ الخطة». ما <حفظته|حفظه> {name} يبقى.", target: "plan.save", kind: "save", optional: true },
        ],
      },
      {
        id: "A6.2",
        role: "edit",
        q: "كيف أضيف ما <حفظته|حفظه> {name} من قبل؟",
        showMe: true,
        steps: [
          { text: "[انزلي|انزل] إلى «إضافة حفظ سابق».", target: "plan.prior", optional: true },
          { text: "[اختاري|اختر] السور، أو [حدّدي|حدّد] الآيات لجزء من سورة." },
          { text: "[اضغطي|اضغط] «إضافة إلى المحفوظ»." },
        ],
      },
      {
        id: "A6.3",
        role: "edit",
        feat: "goal",
        q: "كيف أضع هدفًا لـ{name}؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «+ هدف للحفظ».", target: "plan.goal", kind: "press", optional: true },
          { text: "[اختاري|اختر] الهدف، ثم «الموعد»." },
          { text: "[اضغطي|اضغط] «حفظ الهدف». <ترى|يرى> {name} المطلوب كل يوم في <صفحتها|صفحته>." },
        ],
      },
      {
        id: "A6.4",
        role: "edit",
        more: true,
        q: "كيف أرتّب السور أو أحذف سورة؟",
        showMe: true,
        steps: [
          { text: "في «ترتيب الخطة» [اضغطي|اضغط] ▲ أو ▼، أو × للحذف.", target: "plan.list", optional: true },
          { text: "[اضغطي|اضغط] «حفظ الخطة».", target: "plan.save", kind: "save", optional: true },
        ],
      },
      {
        id: "A6.5",
        role: "edit",
        more: true,
        q: "كيف أضيف سورة إلى الخطة؟",
        showMe: true,
        steps: [
          { text: "[اختاري|اختر] السورة من القائمة تحت السور.", target: "plan.addSelect", optional: true },
          { text: "[اضغطي|اضغط] «إضافة سورة»، ثم «حفظ الخطة».", target: "plan.addBtn", optional: true },
        ],
      },
    ],
  },
  {
    id: "a.settings",
    title: "إعدادات {name}",
    questions: [
      {
        id: "A7.1",
        role: "edit",
        q: "كيف أفعّل ميزة لـ{name}؟",
        showMe: true,
        steps: [
          { text: "[ضعي|ضع] علامة على الميزة. تُحفظ فورًا.", target: "childSettings.features", optional: true },
          { text: "بعض الميزات تحتاج غيرها أولًا، مثل «تحديد أخطائي في البيت» بعد «حفظي في البيت»." },
        ],
      },
      {
        id: "A7.2",
        role: "edit",
        feat: "streak",
        q: "كيف أختار أيام التزام {name}؟",
        showMe: true,
        steps: [{ text: "في «أيام الالتزام» [اضغطي|اضغط] على الأيام.", target: "childSettings.commit", optional: true }, { text: "تُحفظ وحدها، ويلزم يوم واحد على الأقل." }],
      },
      {
        id: "A7.3",
        role: "edit",
        q: "كيف أضبط تذكير المراجعة؟",
        showMe: true,
        steps: [
          { text: "[ضعي|ضع] علامة على «تذكير المراجعة».", target: "childSettings.review", optional: true },
          { text: "[غيّري|غيّر] «عدد الأيام»، ثم [اضغطي|اضغط] «حفظ»." },
        ],
      },
      { id: "A7.4", role: "view", q: "ماذا يحدث إذا أُوقفت ميزة؟", showMe: false, steps: [{ text: "تختفي من صفحات {name}، ويبقى ما سُجّل فيها محفوظًا." }] },
    ],
  },
];

/** «تفعيل الآن» lines (O1–O9) for an adult with edit rights, by the child's switch. */
export const CHILD_OFFERS: Partial<Record<ChildSwitch, string>> = {
  streak: "تظهر 🔥 بعد تفعيل «أيام الالتزام والسلسلة» لـ{name}. هل [تريدين|تريد] تفعيلها الآن؟",
  summary: "يظهر هذا بعد تفعيل «المحصّلات» لـ{name}. هل [تريدين|تريد] تفعيلها الآن؟",
  agenda: "يظهر هذا بعد تفعيل «الجدول اليومي» لـ{name}. هل [تريدين|تريد] تفعيله الآن؟",
  goal: "يظهر «+ هدف للحفظ» بعد تفعيل «هدف الحفظ» لـ{name}. هل [تريدين|تريد] تفعيله الآن؟",
  review: "يظهر هذا بعد تفعيل «تذكير المراجعة» لـ{name}. هل [تريدين|تريد] تفعيله الآن؟ يبدأ بـ14 يومًا، ويُغيَّر العدد من «إعدادات {name}».",
  similar: "يظهر هذا بعد تفعيل «المتشابهات» لـ{name}. هل [تريدين|تريد] تفعيلها الآن؟",
  tajweed: "يظهر هذا بعد تفعيل «أخطاء التجويد المفصّلة» لـ{name}. هل [تريدين|تريد] تفعيلها الآن؟",
  homeLog: "يظهر هذا بعد تفعيل «حفظي في البيت» لـ{name}. هل [تريدين|تريد] تفعيله الآن؟",
  highlight: "يظهر «تظليل» بعد تفعيل «التظليل» لـ{name}. هل [تريدين|تريد] تفعيله الآن؟",
};
