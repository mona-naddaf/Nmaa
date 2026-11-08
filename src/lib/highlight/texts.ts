// «التظليل»: every text of the feature, in فصحى, for whoever is looking (her
// own pages: hers; the child herself: the child's; an adult on a child's
// page: the adult's). Pure, so the review page and the tests can list them.

import { HIGHLIGHT_COLORS, type HighlightColor } from "./colors";
import { MAX_HIGHLIGHT_AYAT, MAX_HIGHLIGHTS, MAX_HIGHLIGHT_COLORS, MAX_COLOR_NAME, type RangeProblem } from "./rules";

type G = "MALE" | "FEMALE" | null;
const pick = (g: G, f: string, m: string) => (g === "FEMALE" ? f : m);

export function highlightTexts(g: G) {
  return {
    button: "تظليل",
    buttonOn: "إنهاء التظليل",
    buttonAria: "تظليل مقطع من الآيات",
    hintFirst: `${pick(g, "اضغطي", "اضغط")} أول كلمة في المقطع.`,
    hintLast: `${pick(g, "اضغطي", "اضغط")} آخر كلمة في المقطع، أو الكلمة نفسها لتظليلها وحدها.`,
    outside: "هذه الكلمة خارج الآيات المعروضة هنا.",
    problem: {
      invalid: "تعذّر تحديد هذا المقطع.",
      ayat: `التظليل حتى ${MAX_HIGHLIGHT_AYAT} آيات. ${pick(g, "اختاري", "اختر")} كلمة أقرب، ثم ${pick(g, "ظلّلي", "ظلّل")} الباقي في تظليل جديد.`,
      page: `التظليل في صفحة واحدة من المصحف. ${pick(g, "اختاري", "اختر")} كلمة في الصفحة نفسها، ثم ${pick(g, "ظلّلي", "ظلّل")} الباقي في تظليل جديد.`,
      overlap: `يتداخل مع تظليل موجود. لتوسيعه ${pick(g, "أزيليه", "أزله")} ثم ${pick(g, "ظلّلي", "ظلّل")} من جديد.`,
      cap: `${pick(g, "وصلتِ", "وصلتَ")} إلى ${MAX_HIGHLIGHTS} تظليل، وهو الحد الأقصى. ${pick(g, "أزيلي", "أزل")} بعض التظليلات لإضافة غيرها.`,
    } satisfies Record<RangeProblem, string>,
    saveFailed: `تعذّر حفظ التظليل. ${pick(g, "حاولي", "حاول")} مرة أخرى.`,
    removeFailed: `تعذّرت إزالة التظليل. ${pick(g, "حاولي", "حاول")} مرة أخرى.`,
    colorFailed: `تعذّر حفظ اللون. ${pick(g, "حاولي", "حاول")} مرة أخرى.`,
    // the menu of a highlight (highlight mode, a word inside it)
    menuChangeColor: "تغيير اللون",
    menuRemove: "إزالة التظليل",
    lockedBy: (name: string | null) => (name ? `🔒 من ${name}` : "🔒 من أحد البالغين"),
    lockedNote: "لا يمكن تغييره أو إزالته من هنا.",
    // the undo toast
    removed: "أُزيل التظليل.",
    colorRemoved: (defaultName: string) => `أُزيل اللون، وصارت تظليلاته بلون «${defaultName}».`,
    undo: "تراجع",
    // the colour chip and its panel
    chipAria: (name: string) => `اللون الحالي: ${name}. ${pick(g, "اضغطي", "اضغط")} لتغييره`,
    panelTitle: "ألوان التظليل",
    addColor: "+ لون جديد",
    pickNew: `${pick(g, "اختاري", "اختر")} لونًا:`,
    maxColors: `${MAX_HIGHLIGHT_COLORS} ألوان كحدّ أقصى.`,
    namePlaceholder: "اسم اللون (اختياري)",
    nameAria: (label: string) => `اسم اللون ${label}`,
    nameTooLong: `الاسم حتى ${MAX_COLOR_NAME} حرفًا.`,
    renameAria: (name: string) => `تسمية اللون ${name}`,
    removeColor: "إزالة اللون",
    removeColorAria: (name: string) => `إزالة اللون ${name}`,
    defaultNote: "اللون الأساسي لا يُزال.",
    saved: "تم الحفظ ✓",
  };
}

/** A colour as shown: her name for it, or the palette's. */
export const colorName = (c: { color: HighlightColor; name: string | null }) => c.name || HIGHLIGHT_COLORS[c.color].label;

/** The child's «التظليل» switch (settings of a child's page), about the child. */
export function highlightSwitchTexts(child: { name: string; gender: "MALE" | "FEMALE" }) {
  const f = child.gender === "FEMALE";
  return {
    title: "التظليل",
    note: f
      ? `تظلّل ${child.name} مقاطع من الآيات لتنتبه لها أثناء الحفظ. ويمكن لمن له صلاحية التعديل أن يظلّل في صفحاتها أيضًا.`
      : `يظلّل ${child.name} مقاطع من الآيات لينتبه لها أثناء الحفظ. ويمكن لمن له صلاحية التعديل أن يظلّل في صفحاته أيضًا.`,
  };
}
