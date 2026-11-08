import "server-only";
import type { GuideStates } from "../../rules";
import type { ExcuseGuide } from "./excuse-types";

// The guide of «أيام العذر»: its two intro lines and its help questions, word
// for word from the approved review page (claude.ai/artifact/R6tFzqCdgqJcUrTP9pdZWD,
// v2). The feminine form only: nobody else ever receives them. This file
// stays on the server, unlike the rest of the help, so a client import of it
// breaks the build; the text reaches a browser only in the snapshot of a
// woman who may have the feature, and every other account's snapshot lacks
// the key altogether (excuseGuideFor).

export type ExcuseGuideInput = {
  kind: "ADULT" | "CHILD";
  gender: "MALE" | "FEMALE" | null;
  // excuseAllowed(email): the same check the feature itself uses
  excuseAllowed: boolean;
  // guidePreviewAllowed(email): until it opens to everyone
  previewAllowed: boolean;
};

export const excuseGuideEligible = (u: ExcuseGuideInput) => u.kind === "ADULT" && u.gender === "FEMALE" && u.excuseAllowed && u.previewAllowed;

const LINES: Omit<ExcuseGuide, "on" | "help"> = {
  line: {
    tracker: "في أيام العذر يمكنكِ أن تحدّدي ما يُحسب من بنودكِ وما لا يُحسب، أو تجعلي لبندٍ بديلًا. ولا يرى أحدٌ أنكِ معذورة.",
    home: "في أيام العذر يمكنكِ إيقاف الحفظ دون أن تنقطع سلسلة 🔥.",
    button: "تفعيل",
  },
  enabled: {
    tracker: "تم التفعيل ✓ تجدين «بدء العذر» فوق جدولكِ، ويمكنكِ إلغاء تفعيلها من «الإعدادات».",
    home: "تم التفعيل ✓ تجدين «بدء العذر» فوق «جدول المتابعة»، ويمكنكِ إلغاء تفعيلها من «الإعدادات».",
  },
};

const HELP: ExcuseGuide["help"] = {
  tracker: [
    {
      q: "كيف أبدأ أيام العذر وأُنهيها؟",
      more: true,
      showMe: true,
      offer: { feature: "excuse", text: "يظهر زرّ «بدء العذر» بعد تفعيل «أيام العذر». هل تريدين تفعيلها الآن؟" },
      steps: [
        { text: "اضغطي «بدء العذر» فوق جدولكِ.", target: "tracker.excuse", via: ["tracker.back"] },
        { text: "اختاري «الآن»، أو «في وقت سابق» إن كان قد بدأ اليوم أو أمس، ثم حدّدي الوقت." },
        { text: "إن أردتِ إيقاف الحفظ في هذه الأيام، ضعي علامة على «إيقاف الحفظ أيضًا»." },
        { text: "اضغطي «تأكيد». يظهر فوق جدولكِ أنكِ معذورة، ولا يرى ذلك أحدٌ غيركِ." },
        { text: "عند انتهاء العذر اضغطي «انتهى العذر»، ثم اختاري الوقت، ثم اضغطي «تأكيد»." },
      ],
      notes: ["إن لم تُنهيه بنفسكِ ينتهي تلقائيًا بعد 15 يومًا."],
    },
    {
      q: "كيف أحدّد ما يُحسب من البنود في أيام العذر؟",
      more: true,
      showMe: true,
      offer: { feature: "excuse", text: "يظهر حقل «في أيام العذر» في كل بند بعد تفعيل «أيام العذر». هل تريدين تفعيلها الآن؟" },
      steps: [
        { text: "اضغطي «⚙ البنود»، ثم «إدارة البنود».", target: "tracker.menu.items", kind: "press", via: ["tracker.menu"] },
        // ✎ opens the form with «في أيام العذر»: the tour waits for it
        { text: "اضغطي ✎ بجانب البند.", target: "tracker.itemEdit", kind: "press" },
        {
          text: "عند «في أيام العذر» اختاري واحدًا من ثلاثة:",
          target: "tracker.excuseField",
          optional: true,
          options: [
            "«يُحسب كالمعتاد»: يبقى البند كما هو.",
            "«لا يُحسب»: يُرفع من حساب اليوم ما دام العذر قائمًا.",
            "«له بديل»: اكتبي «البديل»، مثل: 100 تسبيحة. يظهر مكان البند في أيام العذر، ويُحسب بدرجته نفسها.",
          ],
        },
        { text: "اضغطي «حفظ»." },
      ],
      notes: ["تجدين الخيارات نفسها عند إضافة بند جديد."],
    },
  ],
  home: [
    {
      q: "هل تنكسر سلسلتي في أيام العذر؟",
      more: true,
      showMe: true,
      offer: { feature: "excuse", text: "لا تنكسر إذا أوقفتِ الحفظ في أيام العذر، وهذا يحتاج إلى تفعيل «أيام العذر». هل تريدين تفعيلها الآن؟" },
      steps: [
        { text: "لا تنكسر إذا اخترتِ «إيقاف الحفظ أيضًا»: تصبح هذه الأيام أيام راحة، ولا تُحسب من أيام الالتزام.", target: "home.streak" },
        { text: "أما إن بدأتِ العذر دون إيقاف الحفظ، فتبقى أيام الالتزام محسوبة كالمعتاد، وقد تنقطع السلسلة إن لم تسجّلي جلسة." },
        { text: "اختاري «إيقاف الحفظ أيضًا» عند الضغط على «بدء العذر»، أو اضغطيه فوق جدولكِ إن كان العذر قد بدأ." },
        { text: "للعودة إلى الحفظ قبل انتهاء العذر اضغطي «استئناف الحفظ». يبقى اليوم متوقّفًا، ويعود الحساب من الغد." },
        { text: "وعند الضغط على «انتهى العذر» يعود الحفظ وحده." },
      ],
      notes: ["الجلسة التي تسجّلينها في يوم متوقّف تُحسب في السلسلة.", "يبقى موعد هدف الحفظ كما هو، ويُوزَّع الباقي على الأيام المتبقية بعد عودتكِ."],
    },
  ],
  settings: [
    {
      q: "كيف أفعّل أيام العذر؟",
      more: true,
      showMe: true,
      offer: { feature: "excuse", text: "يمكنكِ تفعيلها من هنا، أو من بطاقة «أيام العذر» في هذه الصفحة." },
      steps: [
        { text: "المفتاح مفعّل الآن في بطاقة «أيام العذر».", target: "settings.excuse" },
        { text: "يظهر زرّ «بدء العذر» فوق «جدول المتابعة»، وحقل «في أيام العذر» في كل بند." },
        { text: "لإلغاء تفعيلها اضغطي المفتاح «تفعيل أيام العذر». إن كان العذر قائمًا ينتهي الآن، ويبقى ما مضى محسوبًا كما كان." },
      ],
      notes: ["لا يرى أحدٌ أنكِ معذورة."],
    },
  ],
};

/** Her excuse guide; null for anyone else, who then gets none of it. */
export function excuseGuideFor(input: ExcuseGuideInput & { on: boolean }): ExcuseGuide | null {
  return excuseGuideEligible(input) ? { on: input.on, ...LINES, help: HELP } : null;
}

/**
 * What the snapshot adds for excuse: everything for her; for anyone else no
 * key at all, and no trace in the states either (a row left from when the
 * account was registered as a woman).
 */
export function excuseSnapshotParts(input: ExcuseGuideInput & { on: boolean; states: GuideStates }): {
  states: GuideStates;
  facts: { excuse?: boolean };
  excuse?: ExcuseGuide;
} {
  const excuse = excuseGuideFor(input);
  if (excuse) return { states: input.states, facts: { excuse: excuse.on }, excuse };
  const states = { ...input.states };
  delete states["intro.excuse"];
  return { states, facts: {} };
}
