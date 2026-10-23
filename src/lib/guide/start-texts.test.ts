import { test } from "node:test";
import assert from "node:assert/strict";
import { planName, startTexts } from "./start-texts";

const f = startTexts("FEMALE");
const m = startTexts("MALE");

const SUMMARY = { planTemplate: "MUSHAF_REVERSE", priorSurahs: 3, commitDays: "كل يوم", trackerItems: 5, agenda: true, city: "الرياض", reviewDays: 14 };

// every string in the texts, with each function called on a sample value
function all(t: ReturnType<typeof startTexts>): string[] {
  const out: string[] = [];
  const walk = (v: unknown, key = "") => {
    if (typeof v === "string") out.push(v);
    else if (typeof v === "function") {
      if (key === "current") walk(v("MUSHAF_REVERSE"));
      else if (key === "lines") walk(v(SUMMARY));
      else if (key === "added") walk(v(5, 2));
      else if (key === "title") walk([v(null), v("سارة")]);
      else walk(v(3));
    } else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, k));
  };
  walk(t);
  return out;
}

test("start texts: word for word from the review page (feminine)", () => {
  assert.equal(f.welcome.title(null), "أهلًا بكِ في رفيق الحفظ 🌿");
  assert.equal(f.welcome.title("سارة"), "أهلًا بكِ يا سارة 🌿");
  assert.equal(f.q1.title, "من أين تبدئين حفظكِ؟");
  assert.equal(f.q1.undecided, "لم تقرّري بعد؟ الخيار الأول يناسب أكثر الناس.");
  assert.equal(f.q1.customNote, "ستُفتح صفحة «خطتي» في نهاية الأسئلة لتختاري السور.");
  assert.equal(f.q1.current("MUSHAF_REVERSE"), "خطتكِ الآن: من آخر المصحف. إن أردتِ تغييرها فافتحي «خطتي».");
  assert.equal(f.q2.empty, "لم تختاري أي سورة بعد. اختاري سورة، أو اضغطي «لا، أبدأ من البداية».");
  assert.equal(f.saveError, "تعذّر الحفظ. تحقّقي من الاتصال، ثم اضغطي «التالي» مرة أخرى.");
  assert.equal(f.laterNote, "حُفظت إجاباتكِ حتى الآن. تجدين بقية الأسئلة في «صفحتي».");
  assert.equal(f.q4c.noCity, "لم تختاري مدينة بعد. اختاري مدينتكِ، أو اختاري «بساعات محدّدة».");
  assert.equal(f.q4.missing, "لم تختاري جوابًا بعد. اختاري «نعم، أريد جدولًا» أو «لا، ليس الآن».");
  assert.equal(f.q5.missing, "لم تختاري جوابًا بعد. اختاري «نعم، ذكّرني» أو «لا، شكرًا».");
  assert.equal(f.card.line(3), "بقيت لكِ 3 أسئلة لتجهيز الموقع لكِ.");
  assert.equal(f.card.line(1), "بقي لكِ سؤال واحد لتجهيز الموقع لكِ.");
});

test("start texts: the masculine forms, including the possessives the page wrote only in the feminine", () => {
  assert.equal(m.welcome.title(null), "أهلًا بك في رفيق الحفظ 🌿");
  assert.equal(m.q1.title, "من أين تبدأ حفظك؟");
  assert.equal(m.q1.customNote, "ستُفتح صفحة «خطتي» في نهاية الأسئلة لتختار السور.");
  assert.equal(m.q1.skipNote, "لا بأس. ستختار خطتك في نهاية الأسئلة، فالموقع يحتاجها ليبدأ.");
  assert.equal(m.q4.intro.startsWith("جدول المتابعة قائمة بأعمالك اليومية"), true);
  assert.equal(m.q4a.title, "كيف تريد أن تبدأ جدولك؟");
  assert.equal(m.q4a.readyDesc, "جداول شاركها غيرك. تظهر المقترحة أولًا، ولكل جدول زر «عرض البنود».");
  assert.equal(m.q4a.emptyDesc, "ستضيف بنودك بنفسك من «جدول المتابعة».");
  assert.equal(m.q4b.title, "هل تريد ترتيب بنودك بأوقات محدّدة؟");
  assert.equal(m.laterNote, "حُفظت إجاباتك حتى الآن. تجد بقية الأسئلة في «صفحتي».");
  assert.equal(m.q4c.noCity, "لم تختر مدينة بعد. اختر مدينتك، أو اختر «بساعات محدّدة».");
});

test("start texts: no feminine ending left in the masculine texts, and Western digits only", () => {
  // feminine endings: كِ (yours), تِ (you did)
  for (const line of all(m)) assert.doesNotMatch(line, /كِ|تِ/u, line);
  for (const line of [...all(f), ...all(m)]) assert.doesNotMatch(line, /[٠-٩]/u, line);
});

test("start texts: «تمت إضافة» after a template, with items already there", () => {
  assert.equal(f.q4a.added(5, 0), "تمت إضافة 5 بنود إلى جدولكِ ✓ يمكنكِ تعديلها أو حذفها لاحقًا، ولا يتغيّر الجدول الأصلي.");
  assert.equal(m.q4a.added(5, 0), "تمت إضافة 5 بنود إلى جدولك ✓ يمكنك تعديلها أو حذفها لاحقًا، ولا يتغيّر الجدول الأصلي.");
  assert.match(f.q4a.added(3, 2), /تُرك بندان موجودان في جدولكِ بالاسم نفسه\.$/);
  assert.equal(f.q4a.added(0, 4), "كل بنود هذا الجدول موجودة في جدولكِ.");
});

test("start texts: the closing summary lists only what is set", () => {
  const lines = f.done.lines({ planTemplate: "MUSHAF_REVERSE", priorSurahs: 3, commitDays: "كل يوم", trackerItems: 5, agenda: true, city: "الرياض", reviewDays: 14 });
  assert.deepEqual(lines, [
    "الخطة: من آخر المصحف ✓",
    "الحفظ السابق: 3 سور ✓",
    "أيام الالتزام: كل يوم ✓",
    "جدول المتابعة: 5 بنود، بحسب أوقات الصلاة في الرياض ✓",
    "تذكير المراجعة: بعد 14 يومًا ✓",
  ]);
  const bare = f.done.lines({ planTemplate: null, priorSurahs: 0, commitDays: "الأحد، الاثنين", trackerItems: 0, agenda: false, city: null, reviewDays: null });
  assert.deepEqual(bare, ["أيام الالتزام: الأحد، الاثنين ✓"]);
  const hours = f.done.lines({ planTemplate: "CUSTOM", priorSurahs: 1, commitDays: "كل يوم", trackerItems: 1, agenda: true, city: null, reviewDays: 7 });
  assert.deepEqual(hours, ["الخطة: خطة مخصّصة ✓", "الحفظ السابق: سورة واحدة ✓", "أيام الالتزام: كل يوم ✓", "جدول المتابعة: بند واحد، بساعات محدّدة ✓", "تذكير المراجعة: بعد 7 أيام ✓"]);
  assert.equal(f.done.skipped, "ما تخطّيتِه: تذكير المراجعة. يمكنكِ ضبطه من «الإعدادات» متى شئتِ.");
  assert.equal(m.done.skipped, "ما تخطّيتَه: تذكير المراجعة. يمكنك ضبطه من «الإعدادات» متى شئتَ.");
});

test("start texts: plan names", () => {
  assert.equal(planName("MUSHAF_ORDER"), "من أول المصحف");
  assert.equal(planName("JUZ_AMMA_REVERSE"), "جزء عمّ فقط");
  assert.equal(planName("???"), "خطة مخصّصة");
});
