import type { FamilyRawPage } from "./types";

// «؟» for the child herself on her pages (/family), word for word from the
// family guide's review page (section ٤, approved 2026-11-15), with each
// page's welcome line. Her own gender ([f|m]); `feat`: the switch the
// question needs (off: under «أسئلة أخرى» with U1, no «تفعيل الآن»). A step
// marked optional shows its sentence alone where its element isn't on the
// page. Edit the texts only with Mona.

const PRESS = "للشرح خطوة بخطوة [اضغطي|اضغط] «؟» أسفل الشاشة.";

export const CHILD_HELP: FamilyRawPage[] = [
  {
    id: "c.home",
    title: "صفحتي",
    welcome: "هنا [ترين|ترى] أين [وصلتِ|وصلتَ] في [خطتكِ|خطتك]، و[تسجّلين|تسجّل] ما [تحفظينه|تحفظه] كل يوم. " + PRESS,
    questions: [
      {
        id: "C1.1",
        q: "كيف أسجّل ما حفظته أو راجعته اليوم؟",
        showMe: true,
        steps: [
          { text: "[انزلي|انزل] إلى «تسجيل جلسة».", target: "record.section", optional: true },
          { text: "[اختاري|اختر] نوع الجلسة: «حفظ جديد» أو «مراجعة» أو «ربط».", target: "record.type", optional: true },
          { text: "[اختاري|اختر] «السورة»، ثم «من آية» و«إلى آية».", target: "record.range", optional: true },
          { text: "إن كانت الجلسة أمس، [غيّري|غيّر] «تاريخ الجلسة».", target: "record.day", optional: true },
          { text: "[اضغطي|اضغط] «حفظ الجلسة».", target: "record.save", kind: "save", optional: true },
        ],
      },
      {
        id: "C1.2",
        q: "ما الفرق بين «حفظ جديد» و«مراجعة» و«ربط»؟",
        showMe: true,
        steps: [
          { text: "«حفظ جديد»: آيات [تحفظينها|تحفظها] أول مرة. وهو وحده الذي يُقدّم [موضعكِ|موضعك] في الخطة.", target: "record.type", optional: true },
          { text: "«مراجعة»: آيات [حفظتِها|حفظتَها] من قبل و[تقرئينها|تقرؤها] مرة أخرى." },
          { text: "«ربط»: [تقرئين|تقرأ] فيه ما [حفظتِه|حفظتَه] حديثًا مع ما قبله." },
        ],
      },
      {
        id: "C1.3",
        q: "ماذا تعني الأرقام في أعلى الصفحة؟",
        showMe: true,
        steps: [
          { text: "«موضعك الحالي»: آخر آية [سجّلتِها|سجّلتَها] «حفظًا جديدًا».", target: "home.position", optional: true },
          { text: "الأشرطة تبيّن كم [حفظتِ|حفظتَ] من السورة والجزء والخطة.", target: "home.bars", optional: true },
        ],
      },
      {
        id: "C1.4",
        q: "ما الكلمات التي تحتاج مراجعة؟",
        showMe: true,
        steps: [
          {
            text: "في «🔖 كلمات تحتاج مراجعة» الكلمات التي [أخطأتِ|أخطأتَ] فيها حين [سمّعتِ|سمّعتَ] [لأهلكِ|لأهلك].",
            target: "mistakes.section",
            kind: "press",
            missing: "لا توجد كلمات تحتاج مراجعة الآن.",
          },
          { text: "[اقرئيها|اقرأها] مرة بعد مرة حتى [تتقنيها|تتقنها]." },
          { text: "حين [تتقنينها|تتقنها] [أخبري|أخبر] [أهلكِ|أهلك] ليعلّموها «تم الإتقان ✓»." },
        ],
      },
      {
        id: "C1.5",
        q: "ما معنى 🔥 وأيام الأسبوع؟",
        showMe: true,
        feat: "streak",
        steps: [
          { text: "🔥 عدد الأيام المتتالية التي [سجّلتِ|سجّلتَ] فيها جلسة.", target: "home.streak", optional: true },
          { text: "تحته أيام هذا الأسبوع: ✓ يوم [سجّلتِ|سجّلتَ] فيه، و✗ يوم [فاتكِ|فاتك]، و— يوم راحة." },
          { text: "أيام [التزامكِ|التزامك] يختارها [أهلكِ|أهلك]." },
        ],
      },
      {
        id: "C1.6",
        q: "كيف أحذف جلسة سجّلتها خطأً؟",
        showMe: true,
        more: true,
        steps: [
          { text: "[افتحي|افتح] «سجل الجلسات».", target: "history.section", kind: "press", missing: "لا توجد جلسات بعد." },
          { text: "[اضغطي|اضغط] «حذف» تحت الجلسة، ثم «تأكيد الحذف»." },
        ],
        notes: ["الجلسة التي [سجّلتِها|سجّلتَها] مع [أهلكِ|أهلك] يحذفها [أهلكِ|أهلك] فقط."],
      },
      {
        id: "C1.7",
        q: "كيف أراجع سورة يذكّرني بها الموقع؟",
        showMe: true,
        more: true,
        feat: "review",
        steps: [
          { text: "[افتحي|افتح] «🔁 سور تحتاج مراجعة».", target: "review.section", kind: "press", missing: "لا توجد سور تحتاج مراجعة الآن." },
          { text: "[اضغطي|اضغط] «تسجيل مراجعة ←» بجانب السورة." },
          { text: "بعد المراجعة [اضغطي|اضغط] «حفظ الجلسة»." },
        ],
      },
      {
        id: "C1.8",
        q: "ما هدفي؟",
        showMe: true,
        more: true,
        feat: "goal",
        steps: [
          { text: "[هدفكِ|هدفك] يضعه [أهلكِ|أهلك]، ويظهر في أعلى [صفحتكِ|صفحتك].", target: "home.position", optional: true },
          { text: "وتحته ما يلزم حفظه كل يوم [لتصلي|لتصل] إليه في موعده." },
        ],
      },
      {
        id: "C1.9",
        q: "ما علامة ≈ بعد أرقام الآيات؟",
        showMe: true,
        more: true,
        feat: "similar",
        steps: [{ text: "≈ تعني أن للآية آيات تشبهها في القرآن. [اضغطي|اضغط] عليها [لتريها|لتراها]." }],
      },
      {
        // «صفحتي» has no verses for her: here only while a switch is off (the
        // locked line); with both on it is in «حفظي في البيت» (C5.7, C6.7)
        id: "C1.10",
        q: "كيف أظلّل مقطعًا؟",
        showMe: true,
        more: true,
        feat: ["homeLog", "highlight"],
        lockedOnly: true,
        when: "highlight",
        steps: [],
      },
      {
        id: "C1.11",
        q: "لماذا لا يعمل زرّ «حفظ الجلسة»؟",
        showMe: true,
        more: true,
        steps: [
          { text: "إن ظهرت رسالة ⚠️ فوق الزر، [فاقرئيها|فاقرأها].", target: "record.reason", optional: true },
          { text: "إن طُلب سبب [فاكتبيه|فاكتبه] في «سبب هذا التسجيل (إلزامي)»." },
          { text: "[تأكّدي|تأكّد] أن «من آية» أصغر من «إلى آية» أو تساويه." },
        ],
      },
    ],
  },
  {
    id: "c.plan",
    title: "خطتي",
    welcome: "هنا السور التي [ستحفظينها|ستحفظها] بالترتيب، وأين [وصلتِ|وصلتَ] منها. " + PRESS,
    questions: [
      { id: "C2.1", q: "ما الذي أراه هنا؟", showMe: false, steps: [{ text: "السور التي [ستحفظينها|ستحفظها] بالترتيب، وأين [وصلتِ|وصلتَ] منها، والسورة التالية." }] },
      { id: "C2.2", q: "كيف أغيّر خطتي؟", showMe: false, steps: [{ text: "[خطتكِ|خطتك] يختارها [أهلكِ|أهلك]. إن [أردتِ|أردتَ] تغييرها [فاطلبي|فاطلب] منهم." }] },
      { id: "C2.3", q: "هل يضيع حفظي إن تغيّرت خطتي؟", showMe: false, steps: [{ text: "لا. ما [حفظتِه|حفظتَه] يبقى، ويُحسب [موضعكِ|موضعك] من جديد." }] },
      {
        id: "C2.4",
        q: "ما هدفي؟",
        showMe: true,
        feat: "goal",
        steps: [
          { text: "[هدفكِ|هدفك] يضعه [أهلكِ|أهلك]، ويظهر هنا وفي «صفحتي».", target: "plan.goal", optional: true },
          { text: "معه ما يلزم حفظه كل يوم [لتصلي|لتصل] إليه في موعده." },
        ],
      },
    ],
  },
  {
    id: "c.tracker",
    title: "جدول المتابعة",
    welcome: "هنا [أعمالكِ|أعمالك] اليومية. [ضعي|ضع] ✓ على كل بند حين [تنجزينه|تنجزه]. " + PRESS,
    questions: [
      {
        id: "C3.1",
        q: "كيف أعلّم بندًا أنجزته؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] على البند في جدول اليوم، فتظهر عليه ✓.", target: "tracker.sheet", optional: true },
          { text: "للتراجع [اضغطي|اضغط] عليه مرة أخرى." },
          { text: "لبنود الأمس [اضغطي|اضغط] «أمس»." },
        ],
        notes: ["مع «الجدول اليومي»: [اضغطي|اضغط] الدائرة بجانب البند."],
      },
      {
        id: "C3.2",
        q: "كيف أضيف بندًا بنفسي؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «⚙ البنود»، ثم «إدارة البنود».", target: "tracker.menu.items", kind: "press", via: ["tracker.menu"], optional: true },
          { text: "[اضغطي|اضغط] «+ بند جديد».", target: "tracker.newItem", kind: "press", optional: true },
          { text: "[اكتبي|اكتب] «اسم البند»، و[اختاري|اختر] «الدرجة» و«الأيام»." },
          { text: "[اضغطي|اضغط] «إضافة البند»." },
        ],
      },
      {
        id: "C3.3",
        q: "لماذا لا أستطيع تعديل بعض البنود؟",
        showMe: false,
        steps: [{ text: "البند الذي تحته «🔒 من …» أضافه أحد [أهلكِ|أهلك]، فهو الذي يعدّله." }, { text: "[تضعين|تضع] عليه ✓ كالمعتاد." }],
      },
      {
        id: "C3.4",
        q: "كيف أعدّل بندًا أضفته أو أحذفه؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «⚙ البنود»، ثم «إدارة البنود».", target: "tracker.menu.items", kind: "press", via: ["tracker.menu"], optional: true },
          { text: "[اضغطي|اضغط] ✎ بجانب البند لتعديله، أو 🗑 لحذفه.", target: "tracker.itemRow", missing: "لا بنود بعد." },
          { text: "عند الحذف [اضغطي|اضغط] «نعم، حذف»." },
        ],
      },
      {
        id: "C3.5",
        q: "كيف أعطي بندًا وقتًا؟",
        showMe: true,
        feat: "agenda",
        steps: [
          { text: "[اضغطي|اضغط] ⏱ بجانب البند.", target: "agenda.timeBtn", kind: "press", via: ["tracker.back"], missing: "لا بنود لليوم." },
          { text: "[اختاري|اختر] «وقت محدّد» أو «بالنسبة إلى صلاة»، ثم [حدّدي|حدّد] الوقت." },
          { text: "[اضغطي|اضغط] «حفظ الوقت»." },
        ],
        notes: ["وقت البند الذي أضافه [أهلكِ|أهلك] يحدّدونه هم."],
      },
      {
        id: "C3.6",
        q: "كيف أرى التزامي في الأسبوع والشهر؟",
        showMe: true,
        more: true,
        feat: "summary",
        steps: [{ text: "[اضغطي|اضغط] «📊 المحصّلات».", target: "tracker.summary", kind: "press", optional: true }],
      },
    ],
  },
  {
    id: "c.summary",
    title: "المحصّلات",
    welcome: "هنا [التزامكِ|التزامك] بجدول المتابعة في كل أسبوع وشهر وسنة. " + PRESS,
    questions: [
      {
        id: "C4.1",
        q: "كيف أختار الفترة؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «أسبوع» أو «شهر» أو «ربع سنة» أو «نصف سنة» أو «سنة».", target: "summary.periods", optional: true },
          { text: "للفترة السابقة [اضغطي|اضغط] «→ السابق»، وللتالية «التالي ←».", target: "summary.nav", optional: true },
        ],
      },
      {
        id: "C4.2",
        q: "ماذا تعني الدائرة والمربّعات؟",
        showMe: true,
        steps: [
          { text: "الدائرة: كم [التزمتِ|التزمتَ] في الفترة كلها.", target: "summary.ring", optional: true },
          { text: "كل مربّع يوم. كلما غمق لونه زاد [التزامكِ|التزامك]. والنجمة ✦ يوم [أكملتِ|أكملتَ] فيه كل البنود.", target: "summary.mosaic", optional: true },
          { text: "[اضغطي|اضغط] على يوم [لتري|لترى] بنوده." },
        ],
      },
      {
        id: "C4.3",
        q: "كيف أعرف التزامي في كل بند؟",
        showMe: true,
        steps: [
          { text: "[انزلي|انزل] إلى «الالتزام في كل بند».", target: "summary.items", optional: true },
          { text: "[اضغطي|اضغط] على بند [لتري|لترى] [التزامكِ|التزامك] فيه وحده." },
          { text: "للعودة [اضغطي|اضغط] «عرض الكل»." },
        ],
      },
      { id: "C4.4", q: "كيف أعود إلى الجدول؟", showMe: true, steps: [{ text: "[اضغطي|اضغط] «→ جدول المتابعة».", target: "summary.back", kind: "press", optional: true }] },
    ],
  },
  {
    id: "c.homelog",
    title: "حفظي في البيت",
    welcome: "هنا [تتدرّبين|تتدرّب] على المقطع في البيت قبل أن [تسمّعيه|تسمّعه]: سماع، وتكرار، وتسميع لأحد. " + PRESS,
    questions: [
      {
        id: "C5.1",
        q: "كيف أبدأ مقطعًا جديدًا؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «+ مقطع جديد».", target: "homeLog.new", kind: "press", optional: true },
          { text: "[اختاري|اختر] «السورة»، ثم «من الآية» و«إلى الآية»." },
          { text: "[اضغطي|اضغط] «[ابدئي|ابدأ] هذا المقطع»." },
        ],
      },
      {
        id: "C5.2",
        q: "ما معنى «سماع» و«تكرار» و«تسميع لأحد»؟",
        showMe: false,
        steps: [
          { text: "🎧 سماع: [استمعتِ|استمعتَ] إلى قارئ يقرأ المقطع." },
          { text: "🔁 تكرار: [قرأتِه|قرأتَه] [بنفسكِ|بنفسك] من المصحف أو من [حفظكِ|حفظك]." },
          { text: "🗣️ تسميع لأحد: [قرأتِه|قرأتَه] على أحد يسمع [لكِ|لك] ويصحّح." },
        ],
      },
      {
        id: "C5.3",
        q: "كيف أسجّل أني استمعت أو كرّرت؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] على بطاقة المقطع تحت «قيد الحفظ».", target: "homeLog.active", kind: "press", missing: "لا توجد مقاطع قيد الحفظ. [ابدئي|ابدأ] مقطعًا جديدًا أولًا." },
          { text: "[اضغطي|اضغط] + تحت «🎧 سماع» أو «🔁 تكرار» أو «🗣️ تسميع لأحد».", target: "practice.counters", page: "c.segment", optional: true },
        ],
      },
      { id: "C5.4", q: "من يحدّد عدد المرات لكل مقطع؟", showMe: false, steps: [{ text: "[أهلكِ|أهلك] يحدّدون كم مرة [تسمعين|تسمع] المقطع و[تكرّرينه|تكرّره] و[تسمّعينه|تسمّعه]." }] },
      {
        id: "C5.5",
        q: "هل يُقدّم هذا موضعي في الخطة؟",
        showMe: false,
        steps: [{ text: "لا. هذه الصفحة للتدريب فقط." }, { text: "يتقدّم [موضعكِ|موضعك] حين [تسجّلين|تسجّل] جلسة «حفظ جديد» في «صفحتي»." }],
      },
      {
        id: "C5.6",
        q: "أين أجد المقاطع التي أتممتها؟",
        showMe: true,
        more: true,
        steps: [{ text: "في «مقاطع سابقة» أسفل الصفحة.", target: "homeLog.past", missing: "لا توجد مقاطع سابقة بعد." }],
      },
      {
        id: "C5.7",
        q: "كيف أظلّل مقطعًا؟",
        showMe: true,
        more: true,
        feat: "highlight",
        when: "highlight",
        steps: [
          { text: "[اضغطي|اضغط] على بطاقة المقطع تحت «قيد الحفظ».", target: "homeLog.active", kind: "press", missing: "لا توجد مقاطع قيد الحفظ. [ابدئي|ابدأ] مقطعًا جديدًا أولًا." },
          { text: "[اضغطي|اضغط] «تظليل» فوق الآيات.", target: "highlight.button", page: "c.segment" },
          { text: "[اضغطي|اضغط] أول كلمة في المقطع، ثم آخر كلمة.", page: "c.segment" },
          { text: "[اضغطي|اضغط] «إنهاء التظليل» حين [تنتهين|تنتهي].", page: "c.segment" },
        ],
      },
    ],
  },
  {
    id: "c.segment",
    title: "صفحة المقطع",
    welcome: "[اضغطي|اضغط] + في كل مرة [تستمعين|تستمع] أو [تكرّرين|تكرّر] أو [تسمّعين|تسمّع] لأحد.",
    questions: [
      {
        id: "C6.1",
        q: "كيف أسجّل مرة سماع أو تكرار أو تسميع؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] + تحت «سماع» أو «تكرار» أو «تسميع لأحد».", target: "practice.counters", optional: true },
          { text: "يزيد العدد واحدًا، وتظهر ✓ حين يبلغ العدد المطلوب." },
          { text: "إن [ضغطتِ|ضغطتَ] خطأً [فاضغطي|فاضغط] «↶ تراجع»." },
        ],
      },
      {
        id: "C6.2",
        q: "كيف أتدرّب على آية واحدة؟",
        showMe: true,
        steps: [{ text: "[انزلي|انزل] إلى قائمة الآيات.", target: "practice.ayat", optional: true }, { text: "[اضغطي|اضغط] + بجانب الآية." }],
      },
      {
        id: "C6.3",
        q: "كيف أحدّد كلمة أخطأت فيها؟",
        showMe: true,
        feat: "homeMistakes",
        steps: [
          { text: "[اضغطي|اضغط] على الكلمة في الآيات.", target: "practice.text", optional: true },
          { text: "[اختاري|اختر] نوع الخطأ." },
          { text: "حين [تتقنينها|تتقنها]، [اضغطي|اضغط] عليها مرة أخرى و[اختاري|اختر] «تم الإتقان ✓»." },
        ],
      },
      {
        id: "C6.4",
        q: "كيف أنهي المقطع؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «✓ أتممتُ هذا المقطع» أسفل الصفحة.", target: "practice.finish", kind: "save", optional: true },
          { text: "[اضغطي|اضغط] «نعم». ينتقل المقطع إلى «مقاطع سابقة»." },
          { text: "ثم [سجّلي|سجّل] الجلسة في «صفحتي» ليتقدّم [موضعكِ|موضعك]." },
        ],
      },
      {
        id: "C6.5",
        q: "كيف أحذف المقطع؟",
        showMe: true,
        steps: [
          {
            text: "[اضغطي|اضغط] «حذف المقطع» أسفل الصفحة.",
            target: "practice.delete",
            kind: "save",
            missing: "يُحذف المقطع قبل أن [تبدئي|تبدأ] التدريب عليه فقط. بعدها [أنهيه|أنهِه] بـ«✓ أتممتُ هذا المقطع».",
          },
          { text: "[اضغطي|اضغط] «نعم»." },
        ],
      },
      {
        id: "C6.6",
        q: "كيف أعود إلى قائمة مقاطعي؟",
        showMe: true,
        more: true,
        steps: [{ text: "[اضغطي|اضغط] «→ مقاطعي» أعلى الصفحة.", target: "practice.back", kind: "press", optional: true }],
      },
      {
        id: "C6.7",
        q: "كيف أظلّل مقطعًا؟",
        showMe: true,
        more: true,
        feat: "highlight",
        when: "highlight",
        steps: [
          { text: "[اضغطي|اضغط] «تظليل» فوق الآيات.", target: "highlight.button" },
          { text: "[اضغطي|اضغط] أول كلمة في المقطع، ثم آخر كلمة." },
          { text: "[اضغطي|اضغط] «إنهاء التظليل» حين [تنتهين|تنتهي]." },
        ],
      },
    ],
  },
  {
    id: "c.family",
    title: "عائلتي",
    welcome: "هنا ما [تشاركه عائلتكِ معكِ|تشاركه عائلتك معك]، والمناسبات القادمة. " + PRESS,
    questions: [
      {
        id: "C7.1",
        q: "ماذا أرى هنا؟",
        showMe: false,
        steps: [{ text: "في «إخوتك» موضع كل واحد منهم، وهل سجّل اليوم." }, { text: "ويظهر أيضًا ما يشاركه الكبار من تقدّمهم." }, { text: "وفي الأسفل المناسبات القادمة." }],
      },
      { id: "C7.2", q: "لماذا لا أرى إخوتي؟", showMe: false, steps: [{ text: "[أهلكِ|أهلك] يختارون إن كان الأطفال يرون تقدّم إخوتهم." }] },
      { id: "C7.3", q: "كيف أفتح تقويم العائلة؟", showMe: true, steps: [{ text: "[اضغطي|اضغط] «تقويم العائلة ←».", target: "family.calendarLink", kind: "press", optional: true }] },
    ],
  },
  {
    id: "c.calendar",
    title: "التقويم",
    welcome: "تقويم [عائلتكِ|عائلتك]. يراه الجميع، و[يمكنكِ|يمكنك] أن [تضيفي|تضيف] فيه مناسبة. " + PRESS,
    questions: [
      {
        id: "C8.1",
        q: "كيف أضيف مناسبة عائلية؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «+ إضافة مناسبة عائلية».", target: "calendar.add", kind: "press", optional: true },
          { text: "[اكتبي|اكتب] العنوان." },
          { text: "[اختاري|اختر] «ميلادي» أو «هجري»، ثم [حدّدي|حدّد] اليوم." },
          { text: "[اضغطي|اضغط] «حفظ». يراها كل أفراد العائلة." },
        ],
      },
      {
        id: "C8.2",
        q: "كيف أرى مناسبات يوم ما؟",
        showMe: true,
        steps: [{ text: "[اضغطي|اضغط] على اليوم في التقويم.", target: "calendar.grid", kind: "press", optional: true }, { text: "تظهر مناسباته تحت التقويم." }],
      },
      {
        id: "C8.3",
        q: "كيف أعدّل مناسبة أضفتها أو أحذفها؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] على يومها في التقويم.", target: "calendar.grid", kind: "press", optional: true },
          { text: "[اضغطي|اضغط] «تعديل» أو «حذف» تحتها.", target: "calendar.dayItem", missing: "[اختاري|اختر] يومًا فيه مناسبة [أضفتِها|أضفتَها]." },
        ],
        notes: ["[تعدّلين|تعدّل] ما [أضفتِه|أضفتَه] فقط."],
      },
      {
        id: "C8.4",
        q: "كيف أنتقل بين الشهور؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] السهمين بجانب اسم الشهر.", target: "calendar.nav", optional: true },
          { text: "للعودة [اضغطي|اضغط] «العودة إلى الشهر الحالي»." },
        ],
      },
    ],
  },
];
