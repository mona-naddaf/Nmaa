// «بنك جداول المتابعة»: its help questions and «أرِني» steps, word for word from the
// review page (v17, section ٤), with Western digits. Generated with the
// step metadata (kind, page, fallbacks); edit the texts only with Mona.

import type { RafiqHelpPage } from "./index";

export const templates: RafiqHelpPage = {
  id: "templates",
  title: "بنك جداول المتابعة",
  questions: [
    {
      q: "كيف أستعمل جدولًا؟",
      showMe: true,
      steps: [
        {
          text: "[اضغطي|اضغط] «عرض البنود» لـ[تري|ترى] ما فيه.",
          target: "templates.card",
          kind: "press",
          missing: "لم يُنشر أي جدول بعد.",
        },
        { text: "[اضغطي|اضغط] «استخدام الجدول»." },
        { text: "[اضغطي|اضغط] «تأكيد». تُضاف البنود إلى [جدولكِ|جدولك]." },
        { text: "إن كان في [جدولكِ|جدولك] بند بالاسم نفسه فلا يتكرّر." },
        { text: "[يمكنكِ|يمكنك] تعديلها بعد ذلك، ولا يتغيّر الأصل. [تجدينها|تجدها] في «جدول المتابعة»." },
      ],
    },
    {
      q: "كيف أبحث عن جدول؟",
      showMe: true,
      steps: [
        { text: "[اكتبي|اكتب] كلمة في خانة البحث.", target: "templates.search" },
        { text: "[اضغطي|اضغط] «بحث»." },
      ],
    },
    {
      q: "كيف أشارك جدولي هنا؟",
      showMe: true,
      steps: [
        { text: "المشاركة من «جدول المتابعة»، فننتقل إليه." },
        {
          text: "في «مشاركة جدولي» [اضغطي|اضغط] «نشر في بنك الجداول».",
          target: "tracker.publish",
          kind: "press",
          page: "tracker",
          via: ["tracker.menu","tracker.menu.items"],
        },
      ],
    },
    {
      q: "كيف أبلّغ عن جدول غير مناسب؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] «إبلاغ» تحت الجدول." },
        { text: "[اكتبي|اكتب] السبب إن [شئتِ|شئتَ]." },
        { text: "[اضغطي|اضغط] «إرسال البلاغ»." },
        { text: "بعد البلاغ يظهر «[أبلغتِ|أبلغتَ] عنه، وهو قيد المراجعة»." },
      ],
    },
    {
      q: "كيف ألغي نشر جدولي؟",
      showMe: true,
      steps: [
        {
          text: "[ابحثي|ابحث] عن الجدول الذي عليه «منشور من حسابك».",
          target: "templates.own",
          missing: "لم [تنشري|تنشر] جدولًا بعد. النشر من «جدول المتابعة» ← «⚙ البنود» ← «إدارة البنود».",
        },
        { text: "[اضغطي|اضغط] «إلغاء النشر»، ثم «نعم، إلغاء النشر»." },
        { text: "لا يتأثر من استعمله، فبنوده عنده تبقى." },
      ],
    },
    {
      q: "ما معنى «مقترح»؟",
      showMe: false,
      steps: [
        { text: "جداول اختارها فريق «على مُكث» لتكون بداية مناسبة." },
      ],
      more: true,
    },
  ],
};
