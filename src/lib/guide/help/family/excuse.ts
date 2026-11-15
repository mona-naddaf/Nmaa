import "server-only";
import type { GuideTarget } from "../targets";
import type { HelpQuestion } from "../types";
import type { FamilyPageId } from "./types";

// «أيام العذر» in «العائلة»'s help, word for word from the family guide's
// review page (section ٧, approved 2026-11-15). Server only, like Rafiq's
// (../rafiq/excuse.ts): a browser receives these texts only in the props of
// the girl herself, an adult in her «من يرى» list (her tracker) and an adult
// with edit rights who sees her excuse card (her settings). Everyone else's
// props lack them altogether (familyExcuseHelp returns nothing for them).
// Always under «أسئلة أخرى»; no lines introducing it anywhere.

type Q = HelpQuestion<GuideTarget, FamilyPageId>;

// the girl herself: always the feminine
const E1: Q = {
  q: "كيف أبدأ أيام العذر وأُنهيها؟",
  more: true,
  showMe: true,
  steps: [
    { text: "اضغطي «بدء العذر» فوق جدولكِ.", target: "tracker.excuse", via: ["tracker.back"], optional: true },
    { text: "اختاري «الآن»، أو «في وقت سابق» إن بدأ اليوم أو أمس، ثم حدّدي الوقت." },
    { text: "إن أردتِ أن يتوقّف الحفظ في هذه الأيام، ضعي علامة على «إيقاف الحفظ أيضًا»." },
    { text: "اضغطي «تأكيد»." },
    { text: "حين ينتهي العذر اضغطي «انتهى العذر»، ثم اختاري الوقت، ثم «تأكيد»." },
  ],
  notes: ["إن لم تُنهيه بنفسكِ ينتهي وحده بعد 15 يومًا.", "لا يرى العذرَ إلا من اختارهم أهلكِ."],
};

const E2: Q = {
  q: "هل تنكسر سلسلتي في أيام العذر؟",
  more: true,
  showMe: false,
  steps: [
    { text: "لا تنكسر إذا اخترتِ «إيقاف الحفظ أيضًا»." },
    { text: "إن لم تختاريه، تبقى أيامكِ محسوبة كالمعتاد." },
    { text: "يمكنكِ اختياره عند «بدء العذر»، أو فوق جدولكِ بعد أن يبدأ." },
    { text: "للعودة إلى الحفظ قبل انتهاء العذر اضغطي «استئناف الحفظ»." },
  ],
};

// an adult: their own gender ([f|m]); {name} is the girl
const E3: Q = {
  q: "كيف أبدأ العذر لـ{name}؟",
  more: true,
  showMe: true,
  steps: [
    { text: "[اضغطي|اضغط] «بدء العذر» فوق جدول {name}.", target: "tracker.excuse", via: ["tracker.back"], optional: true },
    { text: "[اختاري|اختر] «الآن»، أو «في وقت سابق»، ثم [حدّدي|حدّد] الوقت." },
    { text: "إن [أردتِ|أردتَ] إيقاف حفظها في هذه الأيام، [ضعي|ضع] علامة على «إيقاف الحفظ أيضًا»." },
    { text: "[اضغطي|اضغط] «تأكيد»." },
    { text: "حين ينتهي [اضغطي|اضغط] «انتهى العذر»، ثم [اختاري|اختر] الوقت، ثم «تأكيد»." },
  ],
  notes: ["لا يرى العذرَ إلا من حُدِّد في «من يرى أن {name} معذورة؟»."],
};

const E4: Q = {
  q: "كيف أفعّل أيام العذر لـ{name}؟",
  more: true,
  showMe: true,
  steps: [
    { text: "[ضعي|ضع] علامة على «أيام العذر».", target: "childSettings.excuse", optional: true },
    { text: "في «من يرى أن {name} معذورة؟» [اختاري|اختر] من يرى العذر. ومن لم يُحدَّد لا يرى شيئًا." },
    { text: "لا [تستطيعين|تستطيع] تحديد [نفسكِ|نفسك]؛ يحدّد[كِ|ك] بالغ آخر له صلاحية التعديل." },
  ],
  notes: ["إيقاف المفتاح يُنهي العذر الحالي الآن، ويبقى ما مضى محسوبًا كما كان."],
};

export type FamilyExcuseInput = {
  // the child is a girl, and «أيام العذر» reaches her family (familyExcuseAllowed)
  girl: boolean;
  allowed: boolean;
  // her switch
  on: boolean;
  // «أيام الالتزام والسلسلة» is on for her (E2: no streak, nothing to break)
  streak: boolean;
  viewer:
    | { kind: "child" }
    // sees: in «من يرى أن {name} معذورة؟» (familySees); card: her excuse card shows on her settings for this adult
    | { kind: "adult"; sees: boolean; canEdit: boolean; card: boolean };
};

/** The excuse questions one viewer gets, by page; empty for everyone they aren't for. */
export function familyExcuseHelp(input: FamilyExcuseInput): Partial<Record<FamilyPageId, Q[]>> {
  if (!input.girl || !input.allowed) return {};
  const v = input.viewer;
  if (v.kind === "child") {
    if (!input.on) return {};
    return { "c.tracker": [E1], ...(input.streak ? { "c.home": [E2] } : {}) };
  }
  const out: Partial<Record<FamilyPageId, Q[]>> = {};
  if (input.on && v.sees) out["a.tracker"] = [E3];
  if (v.canEdit && v.card) out["a.settings"] = [E4];
  return out;
}

/** Every excuse text, for the check that nobody else receives any of them. */
export const FAMILY_EXCUSE_MARKS = ["أيام العذر", "بدء العذر", "معذورة", "انتهى العذر"] as const;
