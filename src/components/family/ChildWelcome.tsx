"use client";

import { useState } from "react";
import hl from "@/components/home-log/home-log.module.css";
import { WELCOME_SEEN_COOKIE } from "@/lib/family/rules";

// A child's first visit to «صفحتي» («العائلة», step 7): what each tab is for,
// until her first recorded session. «فهمت» hides it on this device only: a
// plain cookie (WELCOME_SEEN_COOKIE, her id), which the page reads so a
// dismissed card is never rendered at all — no flash before hydration.

type G = "MALE" | "FEMALE";

export function ChildWelcome({ childId, gender }: { childId: string; gender: G }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const p = (m: string, f: string) => (gender === "FEMALE" ? f : m);
  const dismiss = () => {
    document.cookie = `${WELCOME_SEEN_COOKIE}=${encodeURIComponent(childId)}; path=/family; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setHidden(true);
  };
  return (
    <div className={hl.section}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
        {p("مرحبًا بك في صفحتك", "مرحبًا بكِ في صفحتكِ")} 🌱
      </div>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        هنا {p("تسجّل", "تسجّلين")} ما {p("تحفظه", "تحفظينه")} كل يوم، وفي «جدول المتابعة» مهامّك اليومية، وفي «خطتي» السور التي {p("ستحفظها", "ستحفظينها")}، وفي
        «عائلتي» و«التقويم» ما تشاركه عائلتك.
      </p>
      <button type="button" className={hl.ghostBtn} onClick={dismiss}>
        فهمت
      </button>
    </div>
  );
}
