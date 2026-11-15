import type { RafiqHelpPage } from "@/lib/guide/help/rafiq";
import type { GuideTarget } from "@/lib/guide/help/targets";
import type { HelpQuestion } from "@/lib/guide/help/types";
import type { FamilyPageId } from "@/lib/guide/help/family/types";

// «القضاء» in the help («؟»), always under «أسئلة أخرى». Draft — reviewed with
// Mona on the text review page before it's final. Explained, not toured
// (no «أرِني»). [f|m]: the one looking (feminine first); in «العائلة», {name}
// is the child and <f|m> her forms.

type RQ = RafiqHelpPage["questions"][number];

/** «جدول المتابعة» in «رفيق الحفظ»: only where QADA_EMAILS reaches her. */
export const RAFIQ_QADA_HELP: RQ[] = [
  {
    q: "ما «القضاء»؟ وهل يؤثّر في نسبة يومي؟",
    more: true,
    showMe: false,
    when: "qada",
    offer: { feature: "qada", text: "بطاقة «القضاء» تحتاج إلى تفعيل. هل [تريدين|تريد] تفعيلها الآن؟" },
    steps: [
      { text: "بطاقة «القضاء» في أعلى «جدول المتابعة»، [تتابعين|تتابع] فيها ما [عليكِ|عليك] من قضاء الصلوات والصيام وما [قضيتِه|قضيته]." },
      { text: "لا تؤثّر في نسبة [يومكِ|يومك]، ولا في «المحصّلات»، ولا في تهنئة إتمام اليوم، ولا تظهر في «مشاركة جدولي»." },
    ],
  },
  {
    q: "كيف أسجّل صلاة أو يومًا قضيتُه؟",
    more: true,
    showMe: false,
    when: "qada",
    steps: [
      { text: "[اضغطي|اضغط] «+1» بجانب الصلاة أو الصيام. يُسجَّل لليوم." },
      { text: "إن كان القضاء في يوم سابق: [ضعي|ضع] علامة على «في يوم سابق»، [واختاري|واختر] اليوم (حتى 7 أيام)، ثم [اضغطي|اضغط] «+1»." },
      { text: "إن [ضغطتِ|ضغطت] خطأً، [اضغطي|اضغط] «تراجع» خلال 10 ثوانٍ." },
    ],
  },
  {
    q: "سجّلتُ شيئًا خطأً، كيف أحذفه؟",
    more: true,
    showMe: false,
    when: "qada",
    steps: [
      { text: "[اضغطي|اضغط] «السجل» في بطاقة «القضاء». [تجدين|تجد] فيه كل ما [سجّلتِه|سجّلته] مع تاريخه." },
      { text: "[اضغطي|اضغط] 🗑 بجانب السطر، ثم «نعم، حذف»." },
    ],
  },
  {
    q: "كيف يُحسب التقدير؟",
    more: true,
    showMe: false,
    when: "qada",
    steps: [
      { text: "[اضغطي|اضغط] «حساب تقديري»، [واختاري|واختر] الصلوات والمدة. يُحسب الشهر 30 يومًا، ويُستثنى رمضان إن [تركتِ|تركت] علامته." },
      { text: "تظهر النتيجة قبل الحفظ، [ويمكنكِ|ويمكنك] تعديل كل رقم فيها، ثم [اضغطي|اضغط] «حفظ التقدير»." },
    ],
    notes: ["تقدير تقريبي فقط، وليس حكمًا شرعيًا.", "حفظ تقدير جديد يحلّ محلّ التقدير السابق."],
  },
  {
    q: "ما الفرق بين «موعد» و«وتيرة»؟",
    more: true,
    showMe: false,
    when: "qada",
    steps: [
      { text: "«موعد»: [تختارين|تختار] يومًا [تنتهين|تنتهي] قبله، [فترين|فترى] كل يوم ما [عليكِ|عليك] من كل صلاة، وفي الصيام كم يومًا في الأسبوع تقريبًا." },
      { text: "«وتيرة»: [تختارين|تختار] كم من كل صلاة يوميًا، أو كم يومًا في الأسبوع، [فترين|فترى] متى [تنتهين|تنتهي] تقريبًا." },
      { text: "«بدون»: العدد والتقدّم فقط." },
    ],
  },
  {
    q: "كيف تُراعى أيام العذر في الخطة؟",
    more: true,
    showMe: false,
    when: "qadaWoman",
    steps: [
      { text: "تُستثنى أيام العذر المتوقّعة من البداية، حسب ما [كتبتِه|كتبته] في «كم يوم العذر في الشهر تقريبًا؟»." },
      { text: "لذلك يبقى مقدار اليوم كما هو بعد عذر بطوله المعتاد، ولا يزيد عليكِ ما فاتكِ فيه." },
      { text: "وفي أيام العذر نفسها لا يظهر مقدار لليوم." },
    ],
    notes: ["يمكنكِ تغيير المتوسط من «الإعدادات» في بطاقة «القضاء»."],
  },
  {
    q: "من يرى قضائي؟",
    more: true,
    showMe: false,
    when: "qada",
    steps: [{ text: "لا يراه أحد [غيركِ|غيرك]، ولا يُشارَك مع العائلة." }],
  },
  {
    q: "ما زر 👁 في بطاقة «القضاء»؟",
    more: true,
    showMe: false,
    when: "qada",
    steps: [{ text: "يُخفي كل الأرقام في البطاقة، إن كان أحد ينظر إلى الشاشة. [اضغطيه|اضغطه] مرة أخرى لإظهارها. يُحفظ اختياركِ في هذا الجهاز فقط." }],
  },
];

type FQ = HelpQuestion<GuideTarget, FamilyPageId>;

/**
 * «العائلة»: the questions on the child's tracker (her own, and an adult's
 * view of it) while her «القضاء» is on. inList: an adult in a girl's «من
 * يرى…» list (or any adult of a boy); girl: the excuse question, for her and
 * the list only.
 */
export function familyQadaHelp(input: { on: boolean; girl: boolean; viewer: { kind: "child" } | { kind: "adult"; canEdit: boolean; inList: boolean } }): Partial<Record<FamilyPageId, FQ[]>> {
  if (!input.on) return {};
  if (input.viewer.kind === "child") {
    // her own page: [f|m] is hers
    const qs: FQ[] = [
      {
        q: "ما بطاقة «القضاء»؟",
        more: true,
        showMe: false,
        steps: [
          { text: "[تتابعين|تتابع] فيها ما [عليكِ|عليك] من قضاء الصلوات والصيام. لا تؤثّر في نسبة [يومكِ|يومك]." },
          { text: "[اضغطي|اضغط] «+1» بجانب الصلاة أو الصيام بعد أن [تقضيه|تقضيه]، و«تراجع» إن [ضغطتِ|ضغطت] خطأً." },
        ],
        notes: ["لا يراها من أهلك إلا من له صلاحية التعديل."],
      },
      {
        q: "كيف أحذف شيئًا سجّلته خطأً؟",
        more: true,
        showMe: false,
        steps: [{ text: "[اضغطي|اضغط] «السجل»، ثم 🗑 بجانب السطر، ثم «نعم، حذف»." }],
      },
    ];
    if (input.girl)
      qs.push({
        q: "هل يراعي الموعد أيام العذر؟",
        more: true,
        showMe: false,
        steps: [{ text: "نعم: تُستثنى أيام العذر المتوقّعة من البداية، فيبقى مقدار اليوم كما هو بعد عذر بطوله المعتاد." }],
      });
    return { "c.tracker": qs };
  }
  if (!input.viewer.canEdit) return {};
  // an adult on her page: [f|m] the adult, <f|m> the child
  const qs: FQ[] = [
    {
      q: "ما بطاقة «قضاء {name}»؟",
      more: true,
      showMe: false,
      steps: [
        { text: "<تتابع|يتابع> فيها {name} ما <عليها|عليه> من قضاء الصلوات والصيام. لا تؤثّر في نسبة <يومها|يومه>." },
        { text: "[يمكنكِ|يمكنك] التسجيل <معها|معه> بـ«+1»، والإضافة بـ«+ إضافة قضاء»، والحذف من «السجل»." },
      ],
    },
  ];
  if (input.girl)
    qs.push({
      q: "من يرى قضاء {name}؟",
      more: true,
      showMe: false,
      steps: [
        { text: "{name} ومن له صلاحية التعديل." },
        { text: "أما قضاء الصيام وخطتها ومتوسط أيام العذر فلا يراها إلا من حُدِّد في «من يرى أن {name} معذورة؟». ومن لم يُحدَّد يرى الصلوات وتقدّمها فقط، والسجل دون تواريخ." },
      ],
    });
  return { "a.tracker": qs };
}
