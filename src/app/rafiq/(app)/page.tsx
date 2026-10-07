import hl from "@/components/home-log/home-log.module.css";
import styles from "../rafiq.module.css";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { pickByPerson } from "@/lib/text/gender";

// Phase 1: the account works; the memorization pages arrive in the next
// phases and replace this list.
export default async function RafiqHomePage() {
  const user = await requireRafiqUser();
  const p = (m: string, f: string) => pickByPerson(user.gender, { m, f });

  return (
    <div>
      <h1 className={styles.welcome}>
        {p("أهلًا بك", "أهلًا بكِ")}
        {user.name && ` يا ${user.name}`} في رفيق الحفظ
      </h1>
      <p className={hl.muted} style={{ margin: "0 4px 16px" }}>
        هنا {p("تتابع", "تتابعين")} حفظك بنفسك، وبياناتك لا يراها أحد غيرك.
      </p>
      <div className={hl.section}>
        <div className={hl.sectionTitle} style={{ margin: "0 0 10px" }}>
          قريبًا في صفحتك
        </div>
        <ul className={styles.soon}>
          <li>
            خطة الحفظ وتسجيل الجلسات
            <small>حفظ جديد ومراجعة وربط، مع حساب الصفحات وأشرطة التقدّم وتحديد الأخطاء</small>
          </li>
          <li>
            حفظي في البيت
            <small>عدّادات السماع والتكرار والتسميع لكل مقطع</small>
          </li>
          <li>
            أيام الالتزام وجدول المتابعة
            <small>أيام {p("تختارها", "تختارينها")} للالتزام، وبنود متابعة يومية {p("تحدّدها", "تحدّدينها")} بنفسك</small>
          </li>
          <li>
            التقويم
            <small>المناسبات الهجرية وأيامك الخاصة</small>
          </li>
        </ul>
      </div>
    </div>
  );
}
