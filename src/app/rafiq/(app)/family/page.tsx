import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { familyEnabled } from "@/lib/family/enabled";
import { myFamilies } from "@/lib/family/data";
import { FAMILY_LIMITS } from "@/lib/family/rules";
import { pickByPerson } from "@/lib/text/gender";
import hl from "@/components/home-log/home-log.module.css";
import styles from "../../rafiq.module.css";
import f from "./family.module.css";
import { targetAttr } from "@/lib/guide/help/targets";
import { guideEnabled } from "@/lib/guide/enabled";

// «عائلاتي»: the families she belongs to, and creating or joining one. With
// exactly one family she goes straight to it (?list=1 shows this page anyway,
// for creating or joining another).
export default async function FamiliesPage({ searchParams }: PageProps<"/rafiq/family">) {
  if (!familyEnabled()) redirect("/rafiq");
  const user = await requireRafiqUser();
  const families = await myFamilies(user.id);
  const { list } = await searchParams;
  if (families.length === 1 && list !== "1") redirect(`/rafiq/family/${families[0].id}`);
  const p = (m: string, fem: string) => pickByPerson(user.gender, { m, f: fem });
  const full = families.length >= FAMILY_LIMITS.familiesPerAdult;

  return (
    <div className={styles.settingsGrid}>
      <div className={hl.sectionTitle} style={{ margin: "0 4px" }}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>عائلاتي</span>
      </div>
      {families.length === 0 ? (
        <div className={hl.section}>
          <p className={hl.muted} style={{ marginTop: 0 }}>
            في العائلة {p("تتابع", "تتابعين")} حفظ أطفالك وجداول متابعتهم، مع بقاء صفحتك في رفيق الحفظ كما هي.
          </p>
          <ol className={f.steps}>
            <li>
              <span className={f.stepMark}>1</span>
              <span>{p("أنشئ", "أنشئي")} عائلة.</span>
            </li>
            <li>
              <span className={f.stepMark}>2</span>
              <span>{p("أضف", "أضيفي")} طفلك، فيحصل على رمز دخول خاص به.</span>
            </li>
            <li>
              <span className={f.stepMark}>3</span>
              <span>يدخل طفلك من بطاقة «العائلة» في الصفحة الرئيسية باسمه ورمزه.</span>
            </li>
          </ol>
          <p className={hl.muted} style={{ marginBottom: 0 }}>
            أو {p("انضمّ", "انضمّي")} إلى عائلة قائمة برمز دعوة من مؤسِّسها.
          </p>
        </div>
      ) : (
        <div className={f.cards}>
          {families.map((fam) => (
            <Link key={fam.id} href={`/rafiq/family/${fam.id}`} className={f.card} {...targetAttr("family.card", guideEnabled() && fam.isFounder)}>
              <span className={f.cardTitle}>{fam.name}</span>
              <span className={f.cardMeta}>
                {fam.isFounder ? p("المؤسِّس", "المؤسِّسة") : p("بالغ", "بالغة")} · البالغون: {fam.adults} · الأطفال: {fam.children}
              </span>
            </Link>
          ))}
        </div>
      )}
      {full ? (
        <p className={hl.muted}>
          {p("بلغتَ", "بلغتِ")} الحدّ الأعلى للعائلات ({FAMILY_LIMITS.familiesPerAdult}).
        </p>
      ) : (
        <div className={hl.actionsRow}>
          <Link href="/rafiq/family/new" className={hl.primaryBtn} style={{ textDecoration: "none" }}>
            + إنشاء عائلة
          </Link>
          <Link href="/rafiq/family/join" className={hl.ghostBtn} style={{ textDecoration: "none" }}>
            الانضمام إلى عائلة
          </Link>
        </div>
      )}
    </div>
  );
}
