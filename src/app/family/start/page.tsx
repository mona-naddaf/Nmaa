import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { familyEnabled } from "@/lib/family/enabled";
import login from "@/app/login/login.module.css";
import s from "./start.module.css";

// The home page's «العائلة» card: an adult signs in with her Rafiq account
// (or creates one) and lands on «عائلاتي»; a child signs in with her name and
// رمز. Both login pages send whoever is already signed in straight on, so
// this page needs no session (and can't see the adult's: her cookie is
// scoped to /rafiq).
export default function FamilyStartPage() {
  if (!familyEnabled()) redirect("/");
  return (
    <div className={login.page}>
      <div className={login.wrap}>
        <div className={login.brand}>
          <BrandLogo variant="login" priority />
        </div>
        <div className={login.subtitle}>العائلة · تجتمع فيها العائلة على القرآن 👪</div>

        <div className={s.choices}>
          <Link href="/rafiq/login?next=/rafiq/family" className={s.choice}>
            <span className={s.icon} aria-hidden="true">🧑</span>
            <span className={s.title}>بالغ / بالغة</span>
            <span className={s.desc}>بحسابك في رفيق الحفظ، أو بحساب جديد</span>
          </Link>
          <Link href="/family/login" className={s.choice}>
            <span className={s.icon} aria-hidden="true">🧒</span>
            <span className={s.title}>طفل / طفلة</span>
            <span className={s.desc}>بالاسم ورمز الدخول من أهلك</span>
          </Link>
        </div>

        <div className={login.adminToggle}>
          <Link href="/">→ رجوع للصفحة الرئيسية</Link>
        </div>
      </div>
    </div>
  );
}
