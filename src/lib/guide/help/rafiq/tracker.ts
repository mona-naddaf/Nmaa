// «جدول المتابعة»: its help questions and «أرِني» steps, word for word from the
// review page (v17, section ٤), with Western digits. Generated with the
// step metadata (kind, page, fallbacks); edit the texts only with Mona.

import type { RafiqHelpPage } from "./index";

export const tracker: RafiqHelpPage = {
  id: "tracker",
  title: "جدول المتابعة",
  questions: [
    {
      q: "كيف أضيف بندًا؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] «⚙ البنود».", target: "tracker.menu", kind: "press" },
        { text: "[اختاري|اختر] «إدارة البنود».", target: "tracker.menu.items", kind: "press" },
        {
          text: "[اضغطي|اضغط] «+ بند جديد».",
          target: "tracker.newItem",
          kind: "press",
          blocked: { target: "tracker.limit", text: "في الجدول الحدّ الأقصى من البنود. [احذفي|احذف] بندًا لتضيف[ي|] غيره." },
        },
        { text: "[اكتبي|اكتب] «اسم البند»، مثل: ورد المراجعة." },
        { text: "[اختاري|اختر] «الدرجة» من 1 إلى 10. البند الأهم يأخذ درجة أعلى في مجموع [يومكِ|يومك]." },
        { text: "[اختاري|اختر] «الأيام»: «كل يوم» أو «أيام محدّدة»." },
        { text: "[اضغطي|اضغط] «إضافة البند»." },
      ],
    },
    {
      q: "كيف أعلّم بندًا أنجزته؟",
      showMe: true,
      steps: [
        {
          text: "[اضغطي|اضغط] على البند في «جدول اليوم». تظهر عليه ✓.",
          target: "tracker.sheet",
          missing: "جدولكِ فارغ. [أضيفي|أضف] بندًا أولًا من «⚙ البنود» ← «إدارة البنود».",
          alt: { when: "agenda", text: "[اضغطي|اضغط] على الدائرة بجانب البند" },
        },
        { text: "للتراجع [اضغطي|اضغط] عليه مرة أخرى." },
        { text: "لبنود الأمس [اضغطي|اضغط] «أمس». [يمكنكِ|يمكنك] تعليم اليوم والأمس فقط." },
        { text: "حين [تكملين|تكمل] كل بنود اليوم تظهر «[أحسنتِ! أكملتِ|أحسنتَ! أكملتَ] بنود اليوم»." },
      ],
    },
    {
      q: "كيف أستعمل جدولًا جاهزًا من غيري؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] «⚙ البنود»، ثم «بنك الجداول».", target: "tracker.menu.bank", kind: "press", via: ["tracker.menu"] },
        { text: "[تنتقلين|تنتقل] إلى «بنك جداول المتابعة»، ويكمل الشرح هناك.", page: "templates" },
      ],
    },
    {
      q: "كيف أعدّل بندًا أو أحذفه؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] «⚙ البنود»، ثم «إدارة البنود».", target: "tracker.menu.items", kind: "press", via: ["tracker.menu"] },
        { text: "[اضغطي|اضغط] ✎ بجانب البند لتعديله، أو 🗑 لحذفه.", target: "tracker.itemRow" },
        { text: "عند الحذف [اضغطي|اضغط] «نعم، حذف». تبقى درجات الأيام السابقة." },
      ],
      notes: [
        "في «الجدول اليومي» [تجدين|تجد] «حذف البند» أيضًا داخل نافذة الوقت ⏱.",
      ],
    },
    {
      q: "كيف أعطي كل بند وقتًا؟",
      showMe: true,
      steps: [
        {
          text: "[اضغطي|اضغط] ⏱ بجانب البند.",
          target: "agenda.timeBtn",
          kind: "press",
          needs: "agenda",
          // ⏱ is on the day only: from «إدارة البنود» or «ترتيب البنود», the way back first
          via: ["tracker.back"],
          missing:
            "يظهر ⏱ بجانب كل بند من بنود اليوم، ولا بنود لليوم في [جدولكِ|جدولك] الآن. [أضيفي|أضف] بندًا من «⚙ البنود» ← «إدارة البنود»، ثم [اضغطي|اضغط] ⏱ بجانبه.",
        },
        { text: "[اختاري|اختر] «وقت محدّد» أو «بالنسبة إلى صلاة»." },
        { text: "[حدّدي|حدّد] الوقت." },
        { text: "[اضغطي|اضغط] «حفظ الوقت»." },
        { text: "بعد إعطاء الأوقات يظهر أعلى الجدول ما [عليكِ|عليك] «الآن» وما «التالي»." },
      ],
      notes: [
        "يظهر ⏱ بجانب بنود اليوم فقط.",
        "أوقات الصلاة تحتاج [مدينتكِ|مدينتك]: «الإعدادات» ← «المدينة (لمواقيت الصلاة)».",
      ],
    },
    {
      q: "كيف أرتّب البنود؟",
      showMe: true,
      steps: [
        {
          text: "[اضغطي|اضغط] «⚙ البنود»، ثم «ترتيب البنود».",
          target: "tracker.menu.order",
          kind: "press",
          needs: "agenda",
          via: ["tracker.menu"],
          missing: "يلزم بندان على الأقل للترتيب.",
        },
        { text: "[اسحبي|اسحب] البند من المقبض ⠿، أو [استعملي|استعمل] السهمين ▲ ▼." },
        { text: "[اضغطي|اضغط] «حفظ الترتيب»." },
      ],
      more: true,
    },
    {
      q: "كيف أرى التزامي في الأسبوع والشهر؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] «📊 المحصّلات».", target: "tracker.summary", kind: "press", needs: "summary" },
      ],
      more: true,
    },
    {
      q: "كيف أشارك جدولي مع غيري؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] «⚙ البنود»، ثم «إدارة البنود»." },
        {
          text: "في «مشاركة جدولي» [اضغطي|اضغط] «نشر في بنك الجداول».",
          target: "tracker.publish",
          kind: "press",
          via: ["tracker.menu","tracker.menu.items"],
        },
        { text: "[اكتبي|اكتب] «عنوان الجدول»." },
        { text: "[اختاري|اختر] البنود، ثم [اضغطي|اضغط] «نشر». لا يظهر [اسمكِ|اسمك]." },
      ],
      more: true,
    },
  ],
};
