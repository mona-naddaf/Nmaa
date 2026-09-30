import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import styles from "./home.module.css";

// TODO: replace with the usage-guide URL once it's available.
const HELP_URL = "#";

// Public landing page: picks the right login for each kind of visitor.
// Staff who are already signed in go straight to their dashboard.
export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect("/students");
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.logoRow}>
          <svg className={styles.logoIcon} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="256" height="256" rx="56" fill="#F5F2E8" />
            <circle cx="128" cy="128" r="88" fill="#EDE7D6" />
            <line x1="128" y1="180" x2="128" y2="100" stroke="#3F6650" strokeWidth="8" strokeLinecap="round" />
            <path d="M128 148 C 92 138, 82 106, 92 78 C 122 90, 132 120, 128 148 Z" fill="#3F6650" />
            <path d="M128 128 C 164 118, 174 86, 164 58 C 134 70, 124 100, 128 128 Z" fill="#5F9178" />
            <ellipse cx="128" cy="182" rx="26" ry="8" fill="#A85C36" opacity="0.3" />
          </svg>
          <h1 className={styles.brand}>نماء</h1>
        </div>
        <div className={styles.tagline}>منصّة متابعة تسميع وحفظ الطالبات والطلاب</div>
        <p className={styles.intro}>
          تتيح المنصّة للمعلمين والمعلمات تسجيل التسميع والحضور والنقاط أولًا بأول، وتمنح المشرف أو المشرفة تحكمًا
          كاملًا بإعدادات الدورة، وتتيح لأولياء الأمور متابعة تقدّم أبنائهم بسهولة ووضوح.
        </p>
      </div>

      <div className={styles.sectionLabel}>اختر طريقة الدخول</div>
      <div className={styles.cards}>
        <Link href="/login" className={`${styles.card} ${styles.staff}`}>
          <div className={styles.cardIcon} aria-hidden="true">📖</div>
          <div className={styles.cardTitle}>معلم / معلمة</div>
          <div className={styles.cardDesc}>تسجيل الدخول بالاسم ورمز الدورة</div>
          <div className={styles.cardArrow}>دخول ←</div>
        </Link>
        <Link href="/login?role=supervisor" className={`${styles.card} ${styles.supervisor}`}>
          <div className={styles.cardIcon} aria-hidden="true">🗝️</div>
          <div className={styles.cardTitle}>مشرف / مشرفة</div>
          <div className={styles.cardDesc}>تسجيل الدخول بالبريد الإلكتروني وكلمة المرور</div>
          <div className={styles.cardArrow}>دخول ←</div>
        </Link>
        <Link href="/parent/login" className={`${styles.card} ${styles.parent}`}>
          <div className={styles.cardIcon} aria-hidden="true">🏠</div>
          <div className={styles.cardTitle}>وليّ الأمر</div>
          <div className={styles.cardDesc}>متابعة تقدّم ابنك أو ابنتك برمز خاص بكم</div>
          <div className={styles.cardArrow}>دخول ←</div>
        </Link>
        <Link href="/board/login" className={`${styles.card} ${styles.board}`}>
          <div className={styles.cardIcon} aria-hidden="true">🏆</div>
          <div className={styles.cardTitle}>لوحة الإنجاز العامة</div>
          <div className={styles.cardDesc}>عرض ترتيب الطلاب برمز لوحة الإنجاز</div>
          <div className={styles.cardArrow}>عرض ←</div>
        </Link>
      </div>

      <a href={HELP_URL} className={styles.helpLink}>
        📖 شروحات استخدام الموقع
      </a>

      <div className={styles.footerNote} aria-hidden="true">
        🌱
      </div>
    </div>
  );
}
