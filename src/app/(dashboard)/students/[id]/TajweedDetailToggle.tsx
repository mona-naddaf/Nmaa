"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OnOffPills } from "../../settings/StudentLoginCard";
import settings from "../../settings/settings.module.css";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { setStudentTajweedDetailedAction } from "./actions";

/** «محاسبة على التجويد المفصّل» for one student (lib/tajweed). */
export function TajweedDetailToggle({ studentId, groupGender, initial }: { studentId: string; groupGender: GroupGender; initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const p = (m: string, f: string) => pickByGroup(groupGender, { m, f });

  function toggle(value: boolean) {
    if (pending) return;
    setOn(value);
    setError(null);
    startTransition(async () => {
      const r = await setStudentTajweedDetailedAction(studentId, value);
      if (r.error) {
        setOn(!value);
        setError(r.error);
        return;
      }
      // the recording form picks the change up straight away
      router.refresh();
    });
  }

  return (
    <>
      <div className={settings.settingRow} style={{ borderBottom: "none" }}>
        <div className={settings.settingText}>
          <div className={settings.settingTitle}>محاسبة على التجويد المفصّل</div>
          <div className={settings.settingDesc}>
            عند التسميع يمكن تحديد خطأ التجويد على الحرف نفسه أو بين كلمتين، مع المخرج أو الصفة أو الحكم. تظهر التفاصيل في قائمة «كلمات
            تحتاج مراجعة» {p("له", "لها")} ولوليّ الأمر.
            {!on && <div style={{ marginTop: 4 }}>عند الإيقاف تبقى {p("أخطاؤه", "أخطاؤها")} المفصّلة المحفوظة ظاهرة بتفاصيلها.</div>}
          </div>
        </div>
        <OnOffPills on={on} onChange={toggle} />
      </div>
      {error && <div className={settings.err}>{error}</div>}
    </>
  );
}
