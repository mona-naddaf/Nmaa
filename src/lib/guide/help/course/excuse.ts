import "server-only";
import type { GuideTarget } from "../targets";
import type { HelpQuestion } from "../types";
import type { CoursePageId } from "./types";
import { offerFor } from "./build";
import { EXCUSE_PARENT_HINT, EXCUSED_HINT } from "@/lib/excuse/texts";

// «أيام العذر» in the courses' help, always under «أسئلة أخرى». This file
// stays on the server, like the Rafiq and family excuse help: each viewer's
// questions are chosen here from the same rules as the feature itself
// (src/lib/excuse/visibility.ts), so nobody who may not see an excuse ever
// receives a word of it: girls' groups only, never staff recorded as male,
// never a parent unless «إظهار العذر لوليّ الأمر» is on for that student.
// The feminine form only: only women and girls receive them (staff with no
// gender recorded count as women, as the feature does).

type Q = HelpQuestion<GuideTarget, CoursePageId>;

export type CourseExcuseViewer =
  // allowed: EXCUSE_ENABLED and the supervisor's email in EXCUSE_ALLOW_EMAILS
  // (courseExcuseAllowed); on: the course's switch; girlsGroups: the course
  // has at least one girls' group; sees: this staff member sees «معذورة» in
  // at least one group (groupSees); itemField: she sets «في أيام العذر» on
  // items (staffSetsItemExcuse)
  | { kind: "staff"; admin: boolean; gender: "MALE" | "FEMALE" | null; allowed: boolean; on: boolean; girlsGroups: boolean; sees: boolean; itemField: boolean; tracker: boolean }
  // her group is a girls' group; tracker: the course's tracker and student login
  | { kind: "student"; girl: boolean; allowed: boolean; on: boolean; tracker: boolean }
  // parentVisible: «إظهار العذر لوليّ الأمر» for this student
  | { kind: "parent"; girl: boolean; allowed: boolean; on: boolean; parentVisible: boolean };

/** The excuse questions this viewer may have, by page; {} for anyone else. */
export function courseExcuseHelp(v: CourseExcuseViewer): Partial<Record<CoursePageId, Q[]>> {
  if (!v.allowed) return {};
  if (v.kind === "parent") {
    if (!v.girl || !v.on || !v.parentVisible) return {};
    return {
      "p.home": [
        {
          q: "ماذا تعني «معذورة»؟",
          more: true,
          showMe: false,
          steps: [{ text: "أنها في أيام العذر. " + EXCUSED_HINT }],
        },
      ],
    };
  }
  if (v.kind === "student") {
    if (!v.girl || !v.on || !v.tracker) return {};
    return {
      "st.tracker": [
        {
          q: "كيف أبدأ أيام العذر وأُنهيها؟",
          more: true,
          showMe: true,
          steps: [
            { text: "اضغطي «بدء العذر» فوق جدولكِ.", target: "tracker.excuse" },
            { text: "اختاري «الآن»، أو «في وقت سابق» إن كان قد بدأ اليوم أو أمس، ثم اضغطي «تأكيد»." },
            { text: "عند انتهاء العذر اضغطي «انتهى العذر»، ثم اختاري الوقت، ثم اضغطي «تأكيد»." },
          ],
          notes: [
            "إن لم تُنهيه بنفسكِ ينتهي تلقائيًا بعد 15 يومًا.",
            "يراه من يحقّ له من مشرفات الدورة ومعلماتها، ولا يراه وليّ الأمر إلا إن أُتيح له.",
          ],
        },
      ],
    };
  }
  // staff: never anyone recorded as male, and only in a course with a girls' group
  if (v.gender === "MALE" || !v.girlsGroups) return {};
  const out: Partial<Record<CoursePageId, Q[]>> = {};
  if (v.admin) {
    out["s.settings"] = [
      {
        q: "ما «أيام العذر»؟",
        more: true,
        showMe: true,
        ...(v.on ? {} : { offer: offerFor("excuse") }),
        steps: [
          { text: "المفتاح في بطاقة «أيام العذر · لمجموعات البنات».", target: "c.card.excuse", kind: "press" },
          { text: "مفعّلةً: تظهر «معذورة» في حضور طالبات مجموعات البنات، و«بدء العذر» في صفحاتهن إن كان جدول المتابعة مفعّلًا." },
        ],
        notes: ["لا يرى «معذورة» من سُجّل رجلًا من المشرفين والمعلمين، ولا وليّ الأمر إلا إن أُتيح له."],
      },
    ];
  }
  if (!v.on || !v.sees) return out;
  out["s.students"] = [
    {
      q: "كيف أسجّل «معذورة» لعدد منهن معًا؟",
      more: true,
      showMe: true,
      steps: [
        { text: "اضغطي «تحديد»، ثم اضغطي على البطاقات.", target: "c.select", kind: "press" },
        { text: "اضغطي «معذورة» في الشريط أسفل الصفحة.", target: "c.bulkBar", missing: "يظهر الشريط بعد تحديد بطاقة واحدة على الأقل، وفيه «معذورة» في مجموعات البنات." },
      ],
    },
  ];
  const student: Q[] = [
    {
      q: "كيف أسجّل أنها معذورة اليوم؟",
      more: true,
      showMe: true,
      steps: [{ text: "اضغطي «معذورة» في الحضور أعلى الصفحة.", target: "c.attendance", missing: "«معذورة» لطالبات مجموعات البنات فقط." }],
      notes: [EXCUSED_HINT],
    },
  ];
  if (v.tracker)
    student.push({
      q: "كيف أبدأ عذرها أو أُنهيه؟",
      more: true,
      showMe: true,
      steps: [
        { text: "اضغطي «بدء العذر» تحت الحضور.", target: "c.excusePanel", missing: "يظهر «بدء العذر» في صفحة طالبة من مجموعة بنات." },
        { text: "اختاري «الآن» أو «في وقت سابق»، ثم اضغطي «تأكيد»." },
        { text: "عند انتهائه اضغطي «انتهى العذر»، ثم «تأكيد»." },
      ],
      notes: ["إن لم يُنهَ ينتهي تلقائيًا بعد 15 يومًا."],
    });
  if (v.admin)
    student.push({
      q: "متى يرى وليّ الأمر عذرها؟",
      more: true,
      showMe: true,
      steps: [
        { text: "افتحي «رمز دخول وليّ الأمر» أسفل الصفحة.", target: "c.parentCode", kind: "press" },
        { text: "ضعي علامة على «إظهار العذر لوليّ الأمر»." },
      ],
      notes: [EXCUSE_PARENT_HINT],
    });
  out["s.student"] = student;
  if (v.tracker && v.itemField)
    out["s.tracker"] = [
      {
        q: "ما «في أيام العذر» في البند؟",
        more: true,
        showMe: false,
        steps: [
          {
            text: "في نموذج البند، عند «في أيام العذر»، اختاري واحدًا من ثلاثة:",
            options: [
              "«يُحسب كالمعتاد»: يبقى البند كما هو.",
              "«لا يُحسب»: يُرفع من حساب اليوم ما دام العذر قائمًا.",
              "«له بديل»: اكتبي «البديل»، مثل: 100 تسبيحة. يظهر مكان البند في أيام العذر.",
            ],
          },
        ],
        notes: ["يظهر الحقل في بنود مجموعات البنات."],
      },
    ];
  return out;
}
