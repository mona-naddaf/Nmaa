// «صفحة الآية»: its help questions and «أرِني» steps, word for word from the
// review page (v17, section ٤), with Western digits. Generated with the
// step metadata (kind, page, fallbacks); edit the texts only with Mona.

import type { RafiqHelpPage } from "./index";

export const verse: RafiqHelpPage = {
  id: "verse",
  title: "صفحة الآية",
  questions: [
    {
      q: "كيف أضيف ملاحظة على هذه الآية؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] «+ ملاحظة جديدة».", target: "verse.newNote", kind: "press" },
        { text: "[اكتبي|اكتب] [ملاحظتكِ|ملاحظتك]." },
        { text: "[اختاري|اختر] حتى 5 وسوم إن [شئتِ|شئتَ]." },
        { text: "[اضغطي|اضغط] «حفظ»." },
      ],
    },
    {
      q: "كيف أعدّل ملاحظة أو أحذفها؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] «تعديل» أو «حذف» تحت الملاحظة.", target: "verse.noteRow", missing: "لا توجد ملاحظات على هذه الآية بعد." },
        { text: "عند الحذف [اضغطي|اضغط] «نعم، حذف»." },
      ],
    },
    {
      q: "كيف أرى الآيات المتشابهة؟",
      showMe: true,
      steps: [
        {
          text: "[اضغطي|اضغط] ≈ بعد رقم الآية.",
          target: "verse.similar",
          kind: "press",
          needs: "similar",
          missing: "ليس لهذه الآية آيات متشابهة.",
        },
        { text: "تظهر الآيات المتشابهة، و[تنتقلين|تنتقل] إلى أيٍّ منها بلمسة." },
        { text: "≈ تظهر بعد الآية الرئيسية فقط، لا بعد الآيتين قبلها وبعدها." },
      ],
    },
    {
      q: "كيف أنتقل إلى آية أخرى؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] «→ الآية السابقة» أو «الآية التالية ←».", target: "verse.nav" },
        { text: "الآية قبلها وبعدها تظهران بلون أخف، [لتقرئي|لتقرأ] الآية في سياقها." },
        { text: "في أول السورة لا يظهر «→ الآية السابقة»، وفي آخرها لا يظهر «الآية التالية ←»." },
        { text: "للعودة إلى القائمة [اضغطي|اضغط] «→ ملاحظاتي»." },
      ],
    },
    {
      q: "ماذا لو انقطع الاتصال وأنا أكتب؟",
      showMe: false,
      steps: [
        { text: "يحفظ الموقع ما [كتبتِه|كتبتَه] على [جهازكِ|جهازك]." },
        { text: "حين [تفتحين|تفتح] الآية تظهر «استعدنا ما [كتبتِه|كتبتَه] ولم يُحفظ بعد»." },
        { text: "[اضغطي|اضغط] «حفظ» لحفظه، أو «تجاهل المسودة»." },
      ],
    },
  ],
};
