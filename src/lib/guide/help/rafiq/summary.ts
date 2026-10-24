// «المحصّلات»: its help questions and «أرِني» steps, word for word from the
// review page (v17, section ٤), with Western digits. Generated with the
// step metadata (kind, page, fallbacks); edit the texts only with Mona.

import type { RafiqHelpPage } from "./index";

export const summary: RafiqHelpPage = {
  id: "summary",
  title: "المحصّلات",
  questions: [
    {
      q: "كيف أختار الفترة؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] على الفترة: «أسبوع» أو «شهر» أو «ربع سنة» أو «نصف سنة» أو «سنة».", target: "summary.periods" },
        { text: "للفترة السابقة [اضغطي|اضغط] «→ السابق»، وللتالية «التالي ←».", target: "summary.nav" },
        { text: "«التالي ←» لا يعمل في الفترة الحالية، لأنها آخر فترة." },
      ],
    },
    {
      q: "ماذا تعني الدائرة والمربعات؟",
      showMe: true,
      steps: [
        { text: "الدائرة نسبة التزامكِ في الفترة كلها.", target: "summary.ring" },
        { text: "كل مربع يوم. كلما غمق لونه زاد التزامكِ، وتحت المربعات مفتاح الألوان. والنجمة ✦ يوم مكتمل.", target: "summary.mosaic" },
        { text: "[اضغطي|اضغط] على يوم لـ[تري|ترى] بنوده." },
      ],
    },
    {
      q: "كيف أعرف التزامي في كل بند؟",
      showMe: true,
      steps: [
        { text: "[انزلي|انزل] إلى «الالتزام في كل بند».", target: "summary.items" },
        { text: "[اضغطي|اضغط] على بند [لترَي|لترى] التزامكِ فيه وحده في الدائرة." },
        { text: "للعودة إلى كل البنود [اضغطي|اضغط] «عرض الكل»، أو البند نفسه مرة أخرى." },
      ],
    },
    {
      q: "ماذا تعني الأرقام تحت الدائرة؟",
      showMe: true,
      steps: [
        { text: "«صفحات الحفظ الجديد» و«جلسات التسميع»: ما [سجّلتِه|سجّلتَه] في «صفحتي» خلال الفترة.", target: "summary.stats" },
        { text: "«أطول سلسلة أيام مكتملة»: أكثر أيام متتالية [أكملتِ|أكملتَ] فيها كل البنود." },
        { text: "🔥: أسابيعكِ المتتالية في الالتزام." },
        { text: "«هدف الحفظ»: تقدّمكِ نحو هدفكِ، إن [وضعتِ|وضعتَ] هدفًا." },
      ],
    },
    {
      q: "كيف أعود إلى الجدول؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] «→ جدول المتابعة».", target: "summary.back", kind: "press" },
      ],
    },
  ],
};
