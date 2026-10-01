import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import styles from "./home.module.css";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { quranFont } from "@/components/mistakes/quran-font";

// The name comes from al-Isra 17:106 — Uthmani text as in the bundled Tanzil
// copy, so it matches the Mushaf.
const NAME_VERSE = "وَقُرْءَانًا فَرَقْنَـٰهُ لِتَقْرَأَهُۥ عَلَى ٱلنَّاسِ عَلَىٰ مُكْثٍ";

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
        <h1 className={styles.brand}>
          <BrandLogo variant="home" priority />
        </h1>
        <figure className={styles.verse}>
          <blockquote className={quranFont.className} lang="ar">
            ﴿{NAME_VERSE}﴾
          </blockquote>
          <figcaption>(الإسراء: ١٠٦)</figcaption>
        </figure>
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
        <Link href="/student/login" className={`${styles.card} ${styles.student}`}>
          <div className={styles.cardIcon} aria-hidden="true">🎓</div>
          <div className={styles.cardTitle}>طالب / طالبة</div>
          <div className={styles.cardDesc}>الدخول بالاسم ورمز الطالب</div>
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

    </div>
  );
}
