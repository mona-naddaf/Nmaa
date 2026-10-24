// «ملاحظاتي»: its help questions and «أرِني» steps, word for word from the
// review page (v17, section ٤), with Western digits. Generated with the
// step metadata (kind, page, fallbacks); edit the texts only with Mona.

import type { RafiqHelpPage } from "./index";

export const notes: RafiqHelpPage = {
  id: "notes",
  title: "ملاحظاتي",
  questions: [
    {
      q: "كيف أكتب ملاحظة على آية؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] «+ ملاحظة على آية».", target: "notes.pickVerse", kind: "press" },
        { text: "[اختاري|اختر] السورة والآية، ثم [اضغطي|اضغط] «فتح الآية»." },
        { text: "[اضغطي|اضغط] «+ ملاحظة جديدة».", target: "verse.newNote", kind: "press", page: "verse" },
        { text: "[اكتبي|اكتب] [ملاحظتكِ|ملاحظتك]، و[اختاري|اختر] وسمًا إن [شئتِ|شئتَ].", page: "verse" },
        { text: "[اضغطي|اضغط] «حفظ».", page: "verse" },
      ],
      notes: [
        "وتظهر ✎ أيضًا بعد أرقام الآيات حين [تسجّلين|تسجّل] جلسة أو [تتدرّبين|تتدرّب] على مقطع.",
      ],
    },
    {
      q: "كيف أعدّل ملاحظة أو أحذفها؟",
      showMe: true,
      steps: [
        { text: "[اضغطي|اضغط] «فتح الآية ←» تحت الملاحظة.", target: "notes.open", kind: "press", missing: "لا توجد ملاحظات بعد." },
        { text: "[اضغطي|اضغط] «تعديل» أو «حذف» تحت الملاحظة.", target: "verse.noteRow", page: "verse" },
        { text: "عند الحذف [اضغطي|اضغط] «نعم، حذف».", page: "verse" },
      ],
    },
    {
      q: "كيف أعرض ملاحظات وسم واحد؟",
      showMe: true,
      steps: [
        { text: "الوسوم الثلاثة «متشابهات» و«تدبّر» و«تفسير» جاهزة [لكِ|لك]، و[يمكنكِ|يمكنك] تغييرها." },
        { text: "[اضغطي|اضغط] على الوسم أعلى القائمة.", target: "notes.tags" },
        { text: "لإلغاء ذلك [اضغطي|اضغط] «إزالة التصفية»." },
      ],
    },
    {
      q: "كيف أبحث في ملاحظاتي؟",
      showMe: true,
      steps: [
        { text: "[اختاري|اختر] السورة، أو [اكتبي|اكتب] كلمة.", target: "notes.search" },
        { text: "[اضغطي|اضغط] «بحث»." },
      ],
    },
    {
      q: "كيف أضيف وسمًا؟",
      showMe: true,
      steps: [
        { text: "في «🏷 وسومي» [اضغطي|اضغط] «+ وسم جديد».", target: "notes.newTag", kind: "press" },
        { text: "[اكتبي|اكتب] اسم الوسم." },
        { text: "[اختاري|اختر] اللون." },
        { text: "[اضغطي|اضغط] «حفظ»." },
      ],
    },
    {
      q: "كيف أعدّل وسمًا أو أحذفه؟",
      showMe: true,
      steps: [
        { text: "في «🏷 وسومي» [اضغطي|اضغط] «تعديل» أو «حذف» بجانب الوسم.", target: "notes.tagRow" },
        { text: "حذف الوسم يزيله من الملاحظات، وتبقى الملاحظات نفسها." },
      ],
      more: true,
    },
    {
      q: "ماذا لو انقطع الاتصال وأنا أكتب؟",
      showMe: false,
      steps: [
        { text: "يحفظ الموقع ما [كتبتِه|كتبتَه] على [جهازكِ|جهازك]." },
        { text: "حين [تفتحين|تفتح] الآية تظهر «استعدنا ما [كتبتِه|كتبتَه] ولم يُحفظ بعد»." },
        { text: "[اضغطي|اضغط] «حفظ» لحفظه، أو «تجاهل المسودة»." },
      ],
      more: true,
    },
  ],
};
