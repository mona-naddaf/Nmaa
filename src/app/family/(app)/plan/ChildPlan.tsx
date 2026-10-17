"use client";

import { useMemo } from "react";
import hl from "@/components/home-log/home-log.module.css";
import { AYAH_COUNT, SURAH_NAME } from "@/lib/quran-data";
import { useToday } from "@/lib/calendar/useToday";
import { computeGoal } from "@/lib/goals/goal";
import { GoalLine } from "@/components/goal/GoalLine";
import type { MemorizationView } from "@/lib/rafiq/memorization";
import { pickByPerson } from "@/lib/text/gender";
import f from "@/app/rafiq/(app)/family/family.module.css";

type Template = "MUSHAF_ORDER" | "MUSHAF_REVERSE" | "JUZ_AMMA_REVERSE" | "CUSTOM";
const TEMPLATE_LABEL: Record<Template, string> = {
  MUSHAF_ORDER: "ترتيب المصحف (من الفاتحة)",
  MUSHAF_REVERSE: "ترتيب المصحف بالعكس (من الناس)",
  JUZ_AMMA_REVERSE: "جزء عمّ بالعكس (من الناس)",
  CUSTOM: "خطة مخصّصة",
};
// the surahs ahead shown one by one; the rest as a count
const SHOWN_AHEAD = 12;

/**
 * «خطتي» of a child («العائلة»): her plan as the adults set it, to read only
 * — the template, where she is, the surahs ahead, and her goal (with its
 * switch). Nothing here changes it.
 */
// about: the child's name when a view-only adult reads it (third person); the child herself otherwise
export function ChildPlan({ data, template, gender, about }: { data: MemorizationView; template: Template | null; gender: "MALE" | "FEMALE"; about?: string }) {
  const today = useToday();
  const p = (m: string, fem: string) => pickByPerson(gender, { m, f: fem });
  // you (the child) / he, she (the child, for an adult)
  const w = (you: [string, string], them: [string, string]) => (about ? p(...them) : p(...you));
  const { plan, position } = data;
  // the surah she is on: the position's, or the next one once it is complete
  let current = position ? plan.indexOf(position.surahNumber) : 0;
  if (position && position.ayah >= AYAH_COUNT[position.surahNumber]) current += 1;
  const done = Math.max(0, current);
  const ahead = plan.slice(current + 1);
  const goal = useMemo(
    () => (data.goal && today ? computeGoal(plan, data.goal, data.history.map((h) => ({ ...h, prior: h.source === "PRIOR" })), today) : null),
    [data.goal, data.history, plan, today],
  );

  return (
    <div>
      <div className={hl.sectionTitle} style={{ margin: "0 4px 6px" }}>
        <span style={{ fontSize: 17, color: "var(--ink)" }}>{about ? `خطة ${about}` : "خطتي"}</span>
      </div>
      {!about && (
        <p className={hl.muted} style={{ margin: "0 4px 12px" }}>
          يختار أهلك خطة حفظك، وهنا {p("تراها", "ترينها")}: أين {p("وصلتَ", "وصلتِ")} وما بعدها.
        </p>
      )}

      <div className={hl.section}>
        <div className={f.rowHead} style={{ marginBottom: 8 }}>
          <span className={f.name}>الخطة</span>
          <span className={f.tag}>{template ? TEMPLATE_LABEL[template] : "—"}</span>
          <span className={f.tag}>{plan.length} سورة</span>
        </div>
        <div style={{ fontSize: 14, color: "var(--ink)", marginBottom: 6 }}>
          {current >= plan.length
            ? `🎉 ${w(["أتممتَ", "أتممتِ"], ["أتمّ", "أتمّت"])} ${w(["خطتك", "خطتك"], ["خطته", "خطتها"])} كلها!`
            : position && plan[current] === position.surahNumber
              ? `${w(["تحفظ", "تحفظين"], ["يحفظ", "تحفظ"])} الآن: سورة ${SURAH_NAME[plan[current]]} — ${w(["وصلتَ", "وصلتِ"], ["وصل", "وصلت"])} إلى الآية ${position.ayah} من ${AYAH_COUNT[plan[current]]}`
              : `السورة التالية: ${SURAH_NAME[plan[current]]}`}
        </div>
        {done > 0 && (
          <div className={hl.muted}>
            {w(["أتممتَ", "أتممتِ"], ["أتمّ", "أتمّت"])} {done} من {plan.length} سورة في {w(["خطتك", "خطتك"], ["خطته", "خطتها"])}
          </div>
        )}
        <GoalLine goal={goal} feminine={gender === "FEMALE"} invalidHint="الهدف لم يعد ضمن خطتك الحالية." />
      </div>

      {ahead.length > 0 && (
        <div className={hl.section}>
          <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
            ما بعدها
          </div>
          <ol style={{ margin: 0, paddingInlineStart: 22, lineHeight: 2 }}>
            {ahead.slice(0, SHOWN_AHEAD).map((s) => (
              <li key={s}>
                {SURAH_NAME[s]} <span className={hl.muted}>({AYAH_COUNT[s]} آية)</span>
              </li>
            ))}
          </ol>
          {ahead.length > SHOWN_AHEAD && <div className={hl.muted}>و{ahead.length - SHOWN_AHEAD} سورة بعدها</div>}
        </div>
      )}
    </div>
  );
}
