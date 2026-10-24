// «التقويم»: its help questions and «أرِني» steps, word for word from the
// review page (v17, section ٤), with Western digits. Generated with the
// step metadata (kind, page, fallbacks); edit the texts only with Mona.

import type { RafiqHelpPage } from "./index";

export const calendar: RafiqHelpPage = {
  id: "calendar",
  title: "التقويم",
  questions: [
    {
      q: "كيف أضيف يومًا خاصًا؟",
      showMe: true,
      steps: [
        { text: "اليوم الخاص: يوم [تريدين|تريد] تذكّره، مثل موعد ختمة أو مناسبة عائلية." },
        { text: "[اضغطي|اضغط] «+ إضافة يوم خاص».", target: "calendar.add", kind: "press" },
        { text: "[اكتبي|اكتب] العنوان." },
        { text: "[اختاري|اختر] «ميلادي» أو «هجري»، ثم [حدّدي|حدّد] اليوم." },
        { text: "«الوصف» اختياري." },
        { text: "[اضغطي|اضغط] «حفظ»." },
      ],
      notes: [
        "أو [اضغطي|اضغط] على اليوم في التقويم، ثم «+ إضافة يوم خاص في هذا اليوم»، فيُملأ التاريخ تلقائيًا.",
      ],
    },
    {
      q: "كيف أرى مناسبات يوم ما؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] على اليوم في التقويم.", target: "calendar.grid", kind: "press" },
        { text: "تظهر مناسباته تحت التقويم." },
      ],
    },
    {
      q: "كيف أعدّل يومًا خاصًا أو أحذفه؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] على اليوم في التقويم.", target: "calendar.grid", kind: "press" },
        { text: "تحت اليوم الخاص [اضغطي|اضغط] «تعديل» أو «حذف».", target: "calendar.dayItem", missing: "لا توجد أيام خاصة بعد." },
        { text: "عند الحذف [اضغطي|اضغط] «تأكيد الحذف»." },
      ],
    },
    {
      q: "كيف أضيف مناسبات أخرى؟",
      showMe: true,
      steps: [
        { text: "[انزلي|انزل] إلى «المناسبات الاختيارية».", target: "calendar.optional" },
        { text: "[اضغطي|اضغط] على المناسبة. تصير «مفعّلة»." },
        { text: "يُحفظ الاختيار فورًا." },
      ],
    },
    {
      q: "كيف أعدّل موعد مناسبة بحسب رؤية الهلال؟",
      showMe: true,
      steps: [
        { text: "التواريخ الهجرية بحسب تقويم أم القرى، وقد تختلف بيوم أو يومين عن رؤية الهلال في [بلدكِ|بلدك]." },
        { text: "في «القادم» [اضغطي|اضغط] «تعديل الموعد بحسب رؤية الهلال» تحت المناسبة.", target: "calendar.upcoming" },
        { text: "[اختاري|اختر] «تقديم يوم» أو «تأخير يوم» أو غيرهما." },
        { text: "يُحفظ الاختيار فورًا، ويخصّ هذه السنة الهجرية فقط." },
      ],
    },
    {
      q: "كيف أنتقل بين الشهور؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] السهمين بجانب اسم الشهر.", target: "calendar.nav" },
        { text: "للعودة [اضغطي|اضغط] «العودة إلى الشهر الحالي»." },
      ],
      more: true,
    },
  ],
};
