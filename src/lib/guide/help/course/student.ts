import "server-only";
import type { CourseRawPage, StudentFacts } from "./types";

// The help on a student's own pages (/student). [f|m]: the student, by her
// group (a girls' group: feminine; boys' or mixed: masculine). Server only.

export const STUDENT_HELP: CourseRawPage<StudentFacts>[] = [
  {
    id: "st.home",
    title: "صفحتي",
    welcome: "هنا [موضعكِ|موضعك] في الخطة [ونقاطكِ|ونقاطك]. يتغيّر بما يُسجَّل في الحلقة.",
    questions: [
      {
        id: "T1.1",
        q: "ماذا يعني «آخر ما [وصلتِ|وصلتَ] إليه»؟",
        showMe: true,
        steps: [
          { text: "هو [موضعكِ|موضعك] في الخطة.", target: "c.stPosition" },
          { text: "يتقدّم كلما [سمّعتِ|سمّعتَ] حفظًا جديدًا في الحلقة وسُجّل [لكِ|لك]." },
        ],
      },
      {
        id: "T1.2",
        q: "كيف أرى نقاطي في فترة معيّنة؟",
        showMe: true,
        steps: [
          {
            text: "[اختاري|اختر] الفترة تحت «[نقاطكِ|نقاطك]»: «الدورة كاملة» أو «آخر 4 أسابيع» أو غيرهما.",
            target: "c.stRange",
            missing: "لا توجد نقاط مسجّلة بعد.",
          },
        ],
      },
      {
        id: "T1.3",
        q: "ما «كلمات [تتدرّبين|تتدرّب] عليها»؟",
        showMe: false,
        steps: [{ text: "كلمات [أخطأتِ|أخطأتَ] فيها في التسميع، وتبقى في القائمة حتى تُعلَّم متقَنة في الحلقة." }],
      },
      {
        id: "T1.4",
        q: "هل يغيّر حفظي في البيت موضعي؟",
        showMe: false,
        more: true,
        feat: "homeLog",
        hideOff: true,
        steps: [{ text: "لا. «حفظي في البيت» للتدريب فقط، ولا يتقدّم [موضعكِ|موضعك] إلا بتسميع في الحلقة." }],
      },
    ],
  },
  {
    id: "st.homelog",
    title: "حفظي في البيت",
    welcome: "هذا سجلّ [تدريبكِ|تدريبك] في البيت. [ابدئي|ابدأ] بـ«+ مقطع جديد».",
    questions: [
      {
        id: "T2.1",
        q: "كيف أبدأ مقطعًا جديدًا؟",
        showMe: true,
        steps: [
          {
            text: "[اضغطي|اضغط] «+ مقطع جديد».",
            target: "homeLog.new",
            kind: "press",
            blocked: { target: "homeLog.limit", text: "[لديكِ|لديك] 5 مقاطع قيد الحفظ، وهو الحدّ. [أتمّي|أتمّ] أحدها أولًا." },
          },
          { text: "[اختاري|اختر] «السورة»، ثم «من الآية» و«إلى الآية». المقترح ما بعد [موضعكِ|موضعك]." },
          { text: "[اضغطي|اضغط] «[ابدئي|ابدأ] هذا المقطع»." },
        ],
      },
      {
        id: "T2.2",
        q: "كيف أسجّل أني استمعت أو كرّرت؟",
        showMe: true,
        steps: [
          {
            text: "[اضغطي|اضغط] على بطاقة المقطع تحت «قيد الحفظ».",
            target: "homeLog.active",
            kind: "press",
            missing: "لا توجد مقاطع قيد الحفظ. [ابدئي|ابدأ] مقطعًا جديدًا أولًا.",
          },
          { text: "في صفحة المقطع [اضغطي|اضغط] + تحت «سماع» أو «تكرار» أو «تسميع لأحد».", target: "practice.counters", page: "st.segment" },
        ],
      },
      {
        id: "T2.3",
        q: "هل يغيّر هذا موضعي في الخطة؟",
        showMe: false,
        steps: [{ text: "لا. هذا سجلّ للتدريب فقط، ولا يتقدّم [موضعكِ|موضعك] إلا بتسميع في الحلقة." }],
      },
      {
        id: "T2.4",
        q: "ما المقطع الذي عليه «📌 واجب»؟",
        showMe: false,
        more: true,
        feat: "assignments",
        hideOff: true,
        steps: [{ text: "مقطع من واجب حفظ، أُضيف [لكِ|لك] تلقائيًا. [تدرّبي|تدرّب] عليه هنا كأي مقطع." }],
      },
    ],
  },
  {
    id: "st.segment",
    title: "صفحة المقطع",
    questions: [
      {
        id: "T3.1",
        q: "كيف أسجّل مرة سماع أو تكرار أو تسميع؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] + تحت «سماع» أو «تكرار» أو «تسميع لأحد».", target: "practice.counters" },
          { text: "يزيد العدد واحدًا. وإن [ضغطتِ|ضغطتَ] خطأً [فاضغطي|فاضغط] «↶ تراجع»." },
          { text: "كل ضغطة تُحفظ فورًا، فلا يوجد زر حفظ." },
        ],
      },
      {
        id: "T3.2",
        q: "كيف أتدرّب على آية واحدة؟",
        showMe: true,
        steps: [
          { text: "لكل آية عدّاداتها في قسم الآيات. [اضغطي|اضغط] + بجانب الآية.", target: "practice.ayat" },
        ],
      },
      {
        id: "T3.3",
        q: "كيف أحدّد كلمة أخطأت فيها؟",
        showMe: true,
        feat: "homeMistakes",
        hideOff: true,
        steps: [
          { text: "[اضغطي|اضغط] على الكلمة في نصّ الآيات.", target: "practice.text" },
          { text: "[اختاري|اختر] نوع الخطأ. وحين [تتقنينها|تتقنها] [اضغطي|اضغط] عليها مرة أخرى." },
        ],
        notes: ["لا يرى هذه الكلمات أحد [غيركِ|غيرك]."],
      },
      {
        id: "T3.4",
        q: "كيف أنهي المقطع؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «✓ أتممتُ هذا المقطع» أسفل الصفحة.", target: "practice.finish", kind: "save" },
          { text: "[اضغطي|اضغط] «نعم». ينتقل المقطع إلى «مقاطع سابقة»." },
        ],
      },
      {
        id: "T3.5",
        q: "كيف أعود إلى مقاطعي؟",
        showMe: true,
        more: true,
        steps: [{ text: "[اضغطي|اضغط] «→ مقاطعي» أعلى الصفحة.", target: "practice.back", kind: "press" }],
      },
    ],
  },
  {
    id: "st.assignments",
    title: "الواجبات",
    welcome: "هنا [واجباتكِ|واجباتك]. [علّمي|علّم] كل واجب حين [تنجزينه|تنجزه].",
    questions: [
      {
        id: "T4.1",
        q: "كيف أعلّم واجبًا أنجزته؟",
        showMe: true,
        steps: [
          {
            text: "[اضغطي|اضغط] «أنجزتُه؟» بجانب الواجب.",
            target: "c.stAssignList",
            missing: "لا توجد واجبات حاليًا.",
          },
          { text: "إن [ضغطتِه|ضغطتَه] خطأً [فاضغطي|فاضغط] عليه مرة أخرى." },
        ],
      },
      {
        id: "T4.2",
        q: "أين أتدرّب على واجب الحفظ؟",
        showMe: false,
        feat: "homeLog",
        hideOff: true,
        steps: [{ text: "في «حفظي في البيت»: مقطع عليه «📌 واجب». يُعلَّم الواجب منجزًا حين [تبلغين|تبلغ] أهدافه." }],
      },
    ],
  },
  {
    id: "st.tracker",
    title: "جدول المتابعة",
    welcome: "هنا [بنودكِ|بنودك] اليومية. [علّمي|علّم] ما [أنجزتِه|أنجزته] كل يوم.",
    questions: [
      {
        id: "T5.1",
        q: "كيف أعلّم بندًا؟",
        showMe: true,
        steps: [{ text: "[اضغطي|اضغط] على البند بعد أن [تنجزيه|تنجزه]. وللتراجع [اضغطي|اضغط] عليه مرة أخرى.", target: "tracker.sheet", missing: "لا بنود لليوم." }],
      },
      {
        id: "T5.2",
        q: "كيف أضيف بندًا خاصًّا بي؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «⚙ البنود»، ثم «إدارة البنود».", target: "tracker.menu.items", kind: "press", via: ["tracker.menu"] },
          { text: "[اضغطي|اضغط] «+ بند خاص».", target: "c.stOwnItem", kind: "press" },
          { text: "[اكتبي|اكتب] اسمه [واختاري|واختر] الأيام، ثم [اضغطي|اضغط] «إرسال للاعتماد»." },
        ],
        notes: ["يُحتسب البند بعد اعتماده وتحديد درجته."],
      },
      {
        id: "T5.3",
        q: "كيف أرتّب بنودي؟",
        showMe: true,
        feat: "agenda",
        hideOff: true,
        steps: [
          { text: "[اضغطي|اضغط] «⚙ البنود»، ثم «ترتيب البنود».", target: "tracker.menu.order", kind: "press", via: ["tracker.menu"], missing: "يظهر «ترتيب البنود» حين يكون [لديكِ|لديك] بندان على الأقل." },
          { text: "[اسحبي|اسحب] البند أو [استعملي|استعمل] ▲ ▼، ثم [احفظي|احفظ] الترتيب." },
        ],
      },
      {
        id: "T5.4",
        q: "كيف أعطي كل بند وقتًا؟",
        showMe: true,
        feat: "agenda",
        hideOff: true,
        steps: [{ text: "[اضغطي|اضغط] ⏱ بجانب البند في جدول اليوم.", target: "agenda.timeBtn", missing: "يظهر ⏱ بجانب بنود اليوم، ولا بنود لليوم الآن." }],
      },
      {
        id: "T5.5",
        q: "أين المحصّلات؟",
        showMe: true,
        feat: "summary",
        hideOff: true,
        steps: [{ text: "[اضغطي|اضغط] «📊 المحصّلات» أعلى الجدول.", target: "tracker.summary", kind: "press" }],
      },
    ],
  },
  {
    id: "st.summary",
    title: "المحصّلات",
    questions: [
      {
        id: "T6.1",
        q: "كيف أختار الفترة؟",
        showMe: true,
        steps: [
          { text: "[اختاري|اختر] أسبوعًا أو شهرًا أو غيرهما.", target: "summary.periods" },
          { text: "[اضغطي|اضغط] السهمين للفترة السابقة أو التالية.", target: "summary.nav" },
        ],
      },
      {
        id: "T6.2",
        q: "ماذا يعني الرقم في الدائرة؟",
        showMe: true,
        steps: [{ text: "نسبة [التزامكِ|التزامك] بالبنود في هذه الفترة.", target: "summary.ring" }],
      },
    ],
  },
  {
    id: "st.board",
    title: "لوحة الإنجاز",
    questions: [
      {
        id: "T7.1",
        q: "ماذا في لوحة الإنجاز؟",
        showMe: false,
        steps: [{ text: "ترتيب طلاب الدورة بالصفحات والنقاط، للعرض فقط." }],
      },
    ],
  },
];
