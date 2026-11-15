import type { FamilyRawPage } from "./types";

// «؟» on an adult's own family pages («عائلاتي»، the family's page, the
// family calendar), word for word from the family guide's review page
// (section ٦, approved 2026-11-15). By role: founder-only questions are
// hidden for others; edit questions move under «أسئلة أخرى» with U2 for a
// view-only adult. Edit the texts only with Mona.

export const FAMILY_HELP: FamilyRawPage[] = [
  {
    id: "f.list",
    title: "عائلاتي",
    questions: [
      {
        id: "F0.1",
        role: "all",
        q: "كيف أنشئ عائلة؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «+ إنشاء عائلة».", target: "family.create", kind: "press", optional: true },
          { text: "[اكتبي|اكتب] «اسم العائلة».", target: "family.newName", page: "f.new", optional: true },
          { text: "[اضغطي|اضغط] «إنشاء العائلة». [تصبحين|تصبح] [مؤسِّستها|مؤسِّسها].", page: "f.new" },
        ],
      },
      {
        id: "F0.2",
        role: "all",
        q: "كيف أنضمّ إلى عائلة؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «الانضمام إلى عائلة».", target: "family.join", kind: "press", optional: true },
          { text: "[أدخلي|أدخل] «رمز الدعوة» الذي [وصلكِ|وصلك] من مؤسِّس العائلة.", target: "family.joinCode", page: "f.join", optional: true },
          { text: "[اضغطي|اضغط] «[انضمّي|انضمّ]».", page: "f.join" },
        ],
        notes: ["إن [وصلكِ|وصلك] رابط دعوة [فافتحيه|فافتحه]، فيُكتب الرمز وحده."],
      },
      {
        id: "F0.3",
        role: "all",
        q: "ما الفرق بين المؤسِّس والبالغ؟",
        showMe: false,
        steps: [{ text: "المؤسِّس يدعو البالغين، ويحدّد من يعدّل بيانات الأطفال." }, { text: "والبالغ يشاهد بيانات الأطفال، ويعدّلها إن منحه المؤسِّس الصلاحية." }],
      },
    ],
  },
  {
    id: "f.family",
    title: "عائلتي",
    questions: [
      {
        id: "F1",
        role: "edit",
        q: "كيف أضيف طفلًا؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «+ إضافة طفل» في قسم «الأطفال».", target: "family.addChild", kind: "press", optional: true },
          { text: "[اكتبي|اكتب] «اسم الطفل»، وهو الاسم الذي يدخل به.", target: "family.childForm", optional: true },
          { text: "[اختاري|اختر] «ولد» أو «بنت»." },
          { text: "[اضغطي|اضغط] «إضافة». تبدأ بعدها أسئلة قصيرة لتجهيز صفحته." },
        ],
      },
      {
        id: "F2",
        role: "edit",
        q: "كيف يدخل الطفل إلى صفحته؟",
        showMe: true,
        steps: [
          { text: "رمز الدخول بجانب اسم الطفل في قسم «الأطفال». [اضغطي|اضغط] «نسخ الرمز».", target: "family.childCode", optional: true },
          { text: "[أعطيه|أعطه] الرمز." },
          { text: "يدخل الطفل من بطاقة «العائلة» في الصفحة الرئيسية، ثم «طفل / طفلة»، باسمه ورمزه." },
        ],
      },
      {
        id: "F3",
        role: "all",
        q: "ما الذي يراه أفراد العائلة من صفحتي؟",
        showMe: true,
        steps: [
          { text: "في «مشاركتي مع العائلة» [تختارين|تختار] ما يراه الكبار والأطفال.", target: "family.sharing", optional: true },
          { text: "«مشاركة تقدّمي»: [موضعكِ|موضعك] وصفحاتك المحفوظة، وهل [سجّلتِ|سجّلتَ] اليوم." },
          { text: "«مشاركة جدولي»: نسبة إنجاز الجدول فقط، دون أسماء البنود." },
        ],
        notes: ["كلاهما متوقف في البداية. ولا تُشارَك ملاحظاتك ولا أخطاؤك ولا حفظك في البيت أبدًا."],
      },
      {
        id: "F4",
        role: "founder",
        q: "كيف أدعو بالغًا إلى العائلة؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «+ إنشاء رمز دعوة» في «رموز الدعوة».", target: "family.invites", optional: true },
          { text: "[اضغطي|اضغط] «نسخ الرمز» أو «نسخ رابط الدعوة»، و[أرسليه|أرسله] إلى البالغ." },
          { text: "يدخل بحسابه في رفيق الحفظ، أو ينشئ حسابًا، ثم ينضمّ." },
        ],
        notes: ["يصلح الرمز لأكثر من شخص مدة 7 أيام. ولإلغائه [اضغطي|اضغط] «إلغاء الرمز»."],
      },
      {
        id: "F5",
        role: "founder",
        q: "كيف أمنح بالغًا صلاحية التعديل؟",
        showMe: true,
        steps: [
          { text: "في قسم «البالغون» [ضعي|ضع] علامة على «صلاحية تعديل بيانات الأطفال» تحت اسمه.", target: "family.adults", optional: true },
          { text: "تُحفظ فورًا، ويستطيع بعدها أن يسمّع مع الأطفال ويعدّل خططهم وجداولهم وإعداداتهم." },
        ],
      },
      {
        id: "F6",
        role: "all",
        q: "كيف أفتح صفحة طفل؟",
        showMe: true,
        steps: [{ text: "في قسم «الأطفال» [اضغطي|اضغط] «فتح صفحته ←» أو «فتح صفحتها ←».", target: "family.children", optional: true }],
      },
      {
        id: "F7",
        role: "edit",
        more: true,
        q: "متى أستعمل «رمز جديد» و«إيقاف الدخول»؟",
        showMe: true,
        steps: [
          { text: "«رمز جديد»: إن عرف الرمزَ غيرُ الطفل. يتوقّف الرمز القديم، ويخرج الطفل من كل الأجهزة حتى يدخل بالجديد.", target: "family.childCode", optional: true },
          { text: "«إيقاف الدخول»: لإيقاف دخوله مدة. تبقى بياناته، ويعود بـ«إصدار رمز دخول»." },
          { text: "بعد الضغط [اضغطي|اضغط] «نعم، رمز جديد» أو «نعم، إيقاف الدخول»." },
        ],
      },
      {
        id: "F8",
        role: "founder",
        more: true,
        q: "كيف أجعل الأطفال يرون تقدّم إخوتهم؟",
        showMe: true,
        steps: [
          { text: "في «مشاركتي مع العائلة» [ضعي|ضع] علامة على «يرى الأطفال تقدّم إخوتهم».", target: "family.sharing", optional: true },
          { text: "يرى كل طفل موضع إخوته، وهل سجّلوا اليوم، ونسبة جدولهم اليوم فقط." },
        ],
      },
      {
        id: "F9",
        role: "edit",
        more: true,
        q: "كيف أحدّد مدينة العائلة لأوقات الصلاة؟",
        showMe: true,
        steps: [
          { text: "[انزلي|انزل] إلى «المدينة (لمواقيت الصلاة)».", target: "family.city", optional: true },
          { text: "[اختاري|اختر] المدينة، ثم [احفظيها|احفظها]." },
        ],
        notes: ["مدينة واحدة لكل أطفال العائلة. ولكلّ بالغ مدينته في إعداداته."],
      },
      {
        id: "F10",
        role: "founder",
        more: true,
        q: "كيف أنقل دور المؤسِّس؟",
        showMe: true,
        steps: [
          { text: "في قسم «البالغون» [اضغطي|اضغط] «نقل دور المؤسِّس» تحت اسم البالغ.", target: "family.adults", optional: true },
          { text: "[اضغطي|اضغط] «نعم، نقل دور المؤسِّس»." },
        ],
        notes: ["[تبقين|تبقى] في العائلة مع صلاحية تعديل بيانات الأطفال."],
      },
      {
        id: "F11a",
        role: "member",
        more: true,
        q: "كيف أغادر العائلة؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «مغادرة العائلة» أسفل الصفحة.", target: "family.leave", optional: true },
          { text: "[اضغطي|اضغط] «نعم، مغادرة العائلة». تبقى [صفحتكِ|صفحتك] في رفيق الحفظ كما هي." },
        ],
      },
      {
        id: "F11b",
        role: "founder",
        more: true,
        q: "كيف أغادر العائلة؟",
        showMe: false,
        steps: [{ text: "المؤسِّس لا يغادر العائلة. [انقلي|انقل] دور المؤسِّس أولًا إلى بالغ آخر، ثم [غادري|غادر]." }],
      },
      {
        id: "F12",
        role: "edit",
        more: true,
        q: "كيف أحذف طفلًا؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «حذف الطفل» أو «حذف الطفلة» تحت اسمه.", target: "family.childCode", optional: true },
          { text: "[اكتبي|اكتب] «حذف»، ثم [اضغطي|اضغط] «حذف نهائيًا»." },
        ],
        notes: ["تُحذف صفحته وكل حفظه ومتابعته، ولا يمكن التراجع عن ذلك."],
      },
      {
        id: "F13",
        role: "founder",
        more: true,
        q: "كيف أغيّر اسم العائلة؟",
        showMe: true,
        steps: [{ text: "[اكتبي|اكتب] الاسم الجديد في «اسم العائلة».", target: "family.rename", optional: true }, { text: "[اضغطي|اضغط] «حفظ»." }],
      },
      {
        id: "F14",
        role: "founder",
        more: true,
        q: "كيف أحذف العائلة؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «حذف العائلة» أسفل الصفحة.", target: "family.card", optional: true },
          { text: "[اكتبي|اكتب] «حذف» و«كلمة المرور الحالية»." },
          { text: "[اضغطي|اضغط] «حذف العائلة نهائيًا»." },
        ],
        notes: ["يُحذف كل الأطفال وبياناتهم، ولا يتغيّر شيء في صفحات البالغين."],
      },
      { id: "F15", role: "all", more: true, q: "كيف أفتح تقويم العائلة؟", showMe: true, steps: [{ text: "[اضغطي|اضغط] «📅 تقويم العائلة ←».", target: "family.calendarLink", kind: "press", optional: true }] },
    ],
  },
  {
    id: "f.calendar",
    title: "تقويم العائلة",
    questions: [
      {
        id: "FC1",
        role: "all",
        q: "كيف أضيف مناسبة عائلية؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] «+ إضافة مناسبة عائلية».", target: "calendar.add", kind: "press", optional: true },
          { text: "[اكتبي|اكتب] العنوان." },
          { text: "[اختاري|اختر] «ميلادي» أو «هجري»، ثم [حدّدي|حدّد] اليوم." },
          { text: "[اضغطي|اضغط] «حفظ». يراها كل أفراد العائلة، الكبار والأطفال." },
        ],
      },
      {
        id: "FC2",
        role: "all",
        q: "كيف أعدّل مناسبة أو أحذفها؟",
        showMe: true,
        steps: [
          { text: "[اضغطي|اضغط] على يومها في التقويم.", target: "calendar.grid", kind: "press", optional: true },
          { text: "[اضغطي|اضغط] «تعديل» أو «حذف» تحتها.", target: "calendar.dayItem", optional: true },
        ],
        roleNotes: { edit: "[تستطيعين|تستطيع] تعديل أي مناسبة وحذفها.", view: "[تعدّلين|تعدّل] ما [أضفتِه|أضفتَه] فقط." },
      },
      {
        id: "FC3",
        role: "all",
        q: "كيف أرى مناسبات يوم ما؟",
        showMe: true,
        steps: [{ text: "[اضغطي|اضغط] على اليوم في التقويم.", target: "calendar.grid", kind: "press", optional: true }, { text: "تظهر مناسباته تحت التقويم." }],
      },
      {
        id: "FC4",
        role: "edit",
        q: "كيف أضيف مناسبات أخرى؟",
        showMe: true,
        steps: [
          { text: "[انزلي|انزل] إلى «المناسبات الاختيارية».", target: "calendar.optional", optional: true },
          { text: "[اضغطي|اضغط] على المناسبة. تُحفظ فورًا لكل العائلة." },
        ],
      },
      {
        id: "FC5",
        role: "edit",
        q: "كيف أعدّل موعد مناسبة بحسب رؤية الهلال؟",
        showMe: true,
        steps: [
          { text: "في «القادم» [اضغطي|اضغط] «تعديل الموعد بحسب رؤية الهلال» تحت المناسبة.", target: "calendar.upcoming", optional: true },
          { text: "[اختاري|اختر] «تقديم يوم» أو «تأخير يوم»." },
          { text: "يُحفظ فورًا لكل العائلة، لهذه السنة الهجرية فقط." },
        ],
      },
      {
        id: "FC6",
        role: "all",
        more: true,
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
