"use client";

import { useState, useTransition } from "react";
import styles from "./settings.module.css";
import {
  setHomeDefaultTargetsAction,
  setHomeLogEnabledAction,
  setHomeMistakesEnabledAction,
  setStudentBoardEnabledAction,
  setStudentFeatureEnabledAction,
  setStudentLoginEnabledAction,
} from "./actions";
import { TargetsEditor } from "@/components/home-log/TargetsEditor";
import type { HomeTargets } from "@/lib/home-log/rules";

export function StudentLoginCard({
  enabled,
  boardEnabled,
  homeLogEnabled,
  homeTargets,
  homeMistakesEnabled,
  assignmentsEnabled,
  trackerEnabled,
}: {
  enabled: boolean;
  boardEnabled: boolean;
  homeLogEnabled: boolean;
  homeTargets: HomeTargets;
  homeMistakesEnabled: boolean;
  assignmentsEnabled: boolean;
  trackerEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // the board option only means something while student login is on
  const dependent = enabled ? undefined : { opacity: 0.5, pointerEvents: "none" as const };
  // self-marked mistakes live inside the home log
  const homeDependent = enabled && homeLogEnabled ? undefined : { opacity: 0.5, pointerEvents: "none" as const };

  function run(action: () => Promise<{ error?: string } | void>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <div className={styles.settingRow}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>دخول الطلاب</div>
          <div className={styles.settingDesc}>
            يدخل كل طالب بالاسم ورمز خاص به (منفصل عن رمز وليّ الأمر)، ليرى موقعه في الخطة وأشرطة التقدّم والكلمات
            التي يتدرّب عليها ونقاطه، للعرض فقط. عند الإيقاف تُخفى رموز الطلاب ويُرفض دخولهم، وتنتهي جلساتهم المفتوحة.
          </div>
        </div>
        <div className={styles.optionPills}>
          <div
            className={`${styles.optionPill} ${enabled ? styles.sel : ""}`}
            onClick={() => !enabled && !pending && run(() => setStudentLoginEnabledAction(true))}
          >
            مفعّل
          </div>
          <div
            className={`${styles.optionPill} ${!enabled ? styles.sel : ""}`}
            onClick={() => enabled && !pending && run(() => setStudentLoginEnabledAction(false))}
          >
            غير مفعّل
          </div>
        </div>
      </div>

      <div className={styles.settingRow} style={dependent} aria-disabled={!enabled}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>لوحة الإنجاز للطلاب</div>
          <div className={styles.settingDesc}>
            إظهار لوحة إنجاز الدورة للطلاب بعد دخولهم (بأسماء جميع طلاب الدورة ونقاطهم وصفحاتهم)، مستقلًا عن رمز
            لوحة الإنجاز العامة.
            {!enabled && " (يتاح بعد تفعيل دخول الطلاب)"}
          </div>
        </div>
        <div className={styles.optionPills}>
          <div
            className={`${styles.optionPill} ${boardEnabled ? styles.sel : ""}`}
            onClick={() => !boardEnabled && !pending && run(() => setStudentBoardEnabledAction(true))}
          >
            مفعّل
          </div>
          <div
            className={`${styles.optionPill} ${!boardEnabled ? styles.sel : ""}`}
            onClick={() => boardEnabled && !pending && run(() => setStudentBoardEnabledAction(false))}
          >
            غير مفعّل
          </div>
        </div>
      </div>
      <div className={styles.settingRow} style={dependent} aria-disabled={!enabled}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>حفظي في البيت</div>
          <div className={styles.settingDesc}>
            يسجّل الطالب ما يحفظه في البيت: مقطعًا من السورة مع عدّادات للسماع والتكرار والتسميع لأحد، ويتابع تقدّمه نحو
            الأهداف. سجلّ منفصل لا يغيّر موقعه الرسمي في الخطة؛ لا يتقدّم الموقع إلا بتسميع يسجّله المعلم. ويظهر
            للمعلمين في صفحة الطالب، ولوليّ الأمر للعرض فقط.
            {!enabled && " (يتاح بعد تفعيل دخول الطلاب)"}
          </div>
          {enabled && homeLogEnabled && (
            <div style={{ marginTop: 12 }}>
              <div className={styles.settingDesc} style={{ fontWeight: 700, marginBottom: 6 }}>
                الأهداف الافتراضية لكل مقطع جديد (يمكن للمعلم تعديلها لكل طالب):
              </div>
              <TargetsEditor initial={homeTargets} onSave={setHomeDefaultTargetsAction} />
            </div>
          )}
        </div>
        <div className={styles.optionPills}>
          <div
            className={`${styles.optionPill} ${homeLogEnabled ? styles.sel : ""}`}
            onClick={() => !homeLogEnabled && !pending && run(() => setHomeLogEnabledAction(true))}
          >
            مفعّل
          </div>
          <div
            className={`${styles.optionPill} ${!homeLogEnabled ? styles.sel : ""}`}
            onClick={() => homeLogEnabled && !pending && run(() => setHomeLogEnabledAction(false))}
          >
            غير مفعّل
          </div>
        </div>
      </div>
      <div className={styles.settingRow} style={homeDependent} aria-disabled={!(enabled && homeLogEnabled)}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>تحديد الطالب لأخطائه في حفظ البيت</div>
          <div className={styles.settingDesc}>
            يحدّد الطالب بنفسه، وهو يتدرّب على مقطع في «حفظي في البيت»، الكلمات التي أخطأ فيها (بالأنواع الأربعة
            نفسها)، ثم يعلّمها متقَنة حين يتقنها. وهي خاصة به وحده: لا تظهر للمعلمين ولا للمشرفين ولا لوليّ الأمر، ولا
            تدخل في التقارير ولا في قائمة الأخطاء الرسمية، ولا تؤثّر في النقاط أو الموقع.
            {enabled && !homeLogEnabled && " (يتاح بعد تفعيل «حفظي في البيت»)"}
            {!enabled && " (يتاح بعد تفعيل دخول الطلاب)"}
          </div>
        </div>
        <OnOffPills on={homeMistakesEnabled} onChange={(v) => !pending && run(() => setHomeMistakesEnabledAction(v))} />
      </div>
      <div className={styles.settingRow} style={dependent} aria-disabled={!enabled}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>الواجبات</div>
          <div className={styles.settingDesc}>
            يكلّف المعلم مجموعة كاملة أو طلابًا محدّدين بواجب (حفظ من القرآن، سؤال، بحث، أو غير ذلك) مع موعد تسليم
            اختياري، ويعلّم الطالب ما أنجزه. ويرى المعلمون من أنجز ومن لم ينجز، ووليّ الأمر للعرض فقط. لا تُمنح نقاط
            تلقائيًا.
            {enabled && !homeLogEnabled && " واجبات الحفظ تحتاج إلى تفعيل «حفظي في البيت»."}
            {!enabled && " (يتاح بعد تفعيل دخول الطلاب)"}
          </div>
        </div>
        <OnOffPills
          on={assignmentsEnabled}
          onChange={(v) => !pending && run(() => setStudentFeatureEnabledAction("assignments", v))}
        />
      </div>

      <div className={styles.settingRow} style={dependent} aria-disabled={!enabled}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>جدول المتابعة</div>
          <div className={styles.settingDesc}>
            بنود يومية يعلّمها الطالب (مثل الورد أو أذكار الصباح)، لكل بند درجة، مع مجموع لليوم وللأسبوع. ويمكن للطالب
            اقتراح بنود خاصة به يعتمدها المعلم. ويظهر للمعلمين في صفحة الطالب وجدول للمجموعة، ولوليّ الأمر للعرض فقط.
            {!enabled && " (يتاح بعد تفعيل دخول الطلاب)"}
          </div>
        </div>
        <OnOffPills on={trackerEnabled} onChange={(v) => !pending && run(() => setStudentFeatureEnabledAction("tracker", v))} />
      </div>
      {error && <div className={styles.err}>{error}</div>}
    </>
  );
}

function OnOffPills({ on, onChange }: { on: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className={styles.optionPills}>
      <div className={`${styles.optionPill} ${on ? styles.sel : ""}`} onClick={() => !on && onChange(true)}>
        مفعّل
      </div>
      <div className={`${styles.optionPill} ${!on ? styles.sel : ""}`} onClick={() => on && onChange(false)}>
        غير مفعّل
      </div>
    </div>
  );
}
