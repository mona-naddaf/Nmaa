"use client";

import { useActionState } from "react";
import Link from "next/link";
import hl from "@/components/home-log/home-log.module.css";
import styles from "../../rafiq.module.css";
import fam from "./family.module.css";
import { ACCOUNT_LIMITS } from "@/lib/rafiq/rules";
import { FAMILY_LIMITS } from "@/lib/family/rules";
import { pickByPerson, type PersonGender } from "@/lib/text/gender";
import { createFamilyAction, joinFamilyAction, type FamilyState } from "./actions";

type P = (m: string, f: string) => string;

/** Asked once, when she has no name in Rafiq yet: the family sees her by it. */
function NameField({ p }: { p: P }) {
  return (
    <div className={styles.formField}>
      <label className={styles.fieldLabel} htmlFor="displayName">
        {p("اسمك", "اسمكِ")}
      </label>
      <input id="displayName" name="displayName" className={styles.input} maxLength={ACCOUNT_LIMITS.nameMax} autoComplete="given-name" required />
      <div className={styles.hint}>يظهر لأفراد العائلة، ويُحفظ في بياناتك في رفيق الحفظ</div>
    </div>
  );
}

function Shell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className={styles.settingsGrid}>
      <div className={fam.head}>
        <span className={fam.title}>{title}</span>
        <Link href="/rafiq/family?list=1" className={fam.back}>
          عائلاتي ←
        </Link>
      </div>
      <div className={hl.section}>
        <p className={hl.muted} style={{ marginTop: 0 }}>
          {intro}
        </p>
        {children}
      </div>
    </div>
  );
}

export function CreateFamilyForm({ gender, needsName }: { gender: PersonGender; needsName: boolean }) {
  const p: P = (m, f) => pickByPerson(gender, { m, f });
  const [state, action, pending] = useActionState<FamilyState, FormData>(createFamilyAction, null);
  return (
    <Shell
      title="إنشاء عائلة"
      intro={`${p("ستكون", "ستكونين")} ${p("مؤسِّس", "مؤسِّسة")} العائلة: ${p("تدعو", "تدعين")} البالغين برمز دعوة، ${p("وتحدّد", "وتحدّدين")} من يستطيع تعديل بيانات الأطفال.`}
    >
      <form action={action}>
        <div className={styles.formField}>
          <label className={styles.fieldLabel} htmlFor="name">
            اسم العائلة
          </label>
          <input id="name" name="name" className={styles.input} maxLength={FAMILY_LIMITS.nameMax} placeholder="مثال: عائلة أحمد" required />
        </div>
        {needsName && <NameField p={p} />}
        {state?.error && <div className={hl.err} style={{ marginBottom: 10 }}>{state.error}</div>}
        <button type="submit" className={hl.primaryBtn} disabled={pending}>
          {pending ? "جارٍ الإنشاء…" : "إنشاء العائلة"}
        </button>
      </form>
    </Shell>
  );
}

export function JoinFamilyForm({ gender, needsName, code }: { gender: PersonGender; needsName: boolean; code: string }) {
  const p: P = (m, f) => pickByPerson(gender, { m, f });
  const [state, action, pending] = useActionState<FamilyState, FormData>(joinFamilyAction, null);
  return (
    <Shell
      title="الانضمام إلى عائلة"
      intro={`${p("أدخل", "أدخلي")} رمز الدعوة الذي ${p("وصلك", "وصلكِ")} من مؤسِّس العائلة. ${p("ستنضمّ", "ستنضمّين")} ${p("مشاهدًا", "مشاهِدةً")} لبيانات الأطفال، ولا يظهر من بياناتك شيء للعائلة إلا ما ${p("تختار", "تختارين")} مشاركته.`}
    >
      <form action={action}>
        <div className={styles.formField}>
          <label className={styles.fieldLabel} htmlFor="code">
            رمز الدعوة
          </label>
          <input
            id="code"
            name="code"
            className={styles.input}
            defaultValue={code}
            placeholder="XXXX-XXXX"
            maxLength={12}
            autoComplete="off"
            dir="ltr"
            style={{ textAlign: "right", letterSpacing: 1 }}
            required
          />
        </div>
        {needsName && <NameField p={p} />}
        {state?.error && <div className={hl.err} style={{ marginBottom: 10 }}>{state.error}</div>}
        <button type="submit" className={hl.primaryBtn} disabled={pending}>
          {pending ? "جارٍ الانضمام…" : p("انضمّ", "انضمّي")}
        </button>
      </form>
    </Shell>
  );
}
