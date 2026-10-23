"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import login from "@/app/login/login.module.css";
import styles from "./rafiq.module.css";
import { pickByPerson, type PersonGender } from "@/lib/text/gender";
import { pointTo } from "@/components/nudge/nudge";

// The recovery رمز, shown exactly once (after sign-up, a recovery, or a
// regeneration in settings). She must tick that she saved it before going on:
// pressing the button before that sends her to the box with a short line.
export function RecoveryCodeCard({
  code,
  gender,
  continueHref,
  continueLabel = "متابعة",
}: {
  code: string;
  gender: PersonGender;
  continueHref?: string;
  continueLabel?: string;
}) {
  const p = (m: string, f: string) => pickByPerson(gender, { m, f });
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [missing, setMissing] = useState(false);
  const box = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className={login.codeBox}>
        <div className={login.codeLabel}>رمز الاستعادة</div>
        <div className={styles.codeVal}>{code}</div>
        <button
          type="button"
          className={login.copyBtn}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "تم النسخ ✓" : "نسخ الرمز"}
        </button>
      </div>
      <p className={styles.codeNote}>
        {p("احتفظ", "احتفظي")} بهذا الرمز في مكان آمن، فهو الطريقة الوحيدة لتعيين كلمة مرور جديدة إن{" "}
        {p("نسيتَها", "نسيتِها")}. <b>لن يظهر مرة أخرى</b>، {p("ويمكنك", "ويمكنكِ")} إنشاء رمز جديد من الإعدادات في أي وقت.
      </p>
      {continueHref && (
        <>
          <label className={styles.confirmRow}>
            <input
              ref={box}
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              aria-describedby={missing && !saved ? "recovery-missing" : undefined}
            />
            حفظتُ رمز الاستعادة في مكان آمن
          </label>
          {missing && !saved && (
            <div id="recovery-missing" className={login.err} role="alert">
              {p("ضع", "ضعي")} علامة على «حفظتُ رمز الاستعادة في مكان آمن» أولًا.
            </div>
          )}
          <Link
            href={continueHref}
            className={login.primaryBtn}
            style={{ display: "block", textAlign: "center", textDecoration: "none" }}
            onClick={(e) => {
              if (saved) return;
              e.preventDefault();
              setMissing(true);
              // the whole row flashes (the box alone is too small to see); focus goes to the box
              pointTo(box.current?.closest("label"), { focus: false });
              box.current?.focus({ preventScroll: true });
            }}
          >
            {continueLabel}
          </Link>
        </>
      )}
    </div>
  );
}
