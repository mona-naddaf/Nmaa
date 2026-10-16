"use client";

import { useState, useTransition } from "react";
import styles from "./settings.module.css";
import { setTajweedDetailEnabledAction } from "./actions";
import { OnOffPills } from "./StudentLoginCard";

/** «أخطاء التجويد المفصّلة»: the course's master switch (supervisor only). */
export function TajweedDetailCard({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(value: boolean) {
    if (pending) return;
    setOn(value);
    setError(null);
    startTransition(async () => {
      const r = await setTajweedDetailEnabledAction(value);
      if (r.error) {
        setOn(!value);
        setError(r.error);
      }
    });
  }

  return (
    <>
      <div className={styles.settingRow} style={{ borderBottom: "none" }}>
        <div className={styles.settingText}>
          <div className={styles.settingDesc}>
            لمن يُحاسَب على التجويد بدقّة: عند اختيار مخرج أو صفة أو حكم تجويد تنقسم الكلمة إلى حروفها، فيُحدَّد الحرف نفسه وما فيه من خطأ،
            ويمكن تحديد خطأ بين كلمتين (كأحكام النون والميم والوقف والابتداء). يُفعَّل لكل طالب وطالبة من صفحته بخيار «محاسبة على التجويد
            المفصّل». رواية حفص عن عاصم من طريق الشاطبية.
            {!on && <div style={{ marginTop: 4 }}>عند الإيقاف تبقى الأخطاء المفصّلة المحفوظة ظاهرة بتفاصيلها، ولا تُضاف أخطاء مفصّلة جديدة.</div>}
          </div>
        </div>
        <OnOffPills on={on} onChange={toggle} />
      </div>
      {error && <div className={styles.err}>{error}</div>}
    </>
  );
}
