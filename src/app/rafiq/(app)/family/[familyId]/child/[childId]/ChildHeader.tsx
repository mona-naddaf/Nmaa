import Link from "next/link";
import hl from "@/components/home-log/home-log.module.css";
import f from "../../../family.module.css";

export type ChildPage = "page" | "tracker" | "home-log" | "plan" | "settings";

// The top of an adult's view of one child: whose page it is, what the adult
// may do there, and the child's pages («حفظه في البيت» only while its switch
// is on).
export function ChildHeader({
  familyId,
  child,
  canEdit,
  on,
  you,
  homeLog = false,
}: {
  familyId: string;
  child: { id: string; name: string; gender: "MALE" | "FEMALE" };
  canEdit: boolean;
  on: ChildPage;
  // the adult looking
  you: "MALE" | "FEMALE";
  homeLog?: boolean;
}) {
  const p = (m: string, fem: string) => (you === "FEMALE" ? fem : m);
  const g = (m: string, fem: string) => (child.gender === "FEMALE" ? fem : m);
  const base = `/rafiq/family/${familyId}/child/${child.id}`;
  const tabs: { key: ChildPage; href: string; label: string }[] = [
    { key: "page", href: base, label: g("صفحته", "صفحتها") },
    { key: "tracker", href: `${base}/tracker`, label: "جدول المتابعة" },
    ...(homeLog ? [{ key: "home-log" as const, href: `${base}/home-log`, label: g("حفظه في البيت", "حفظها في البيت") }] : []),
    { key: "plan", href: `${base}/plan`, label: g("خطته", "خطتها") },
    { key: "settings", href: `${base}/settings`, label: `إعدادات ${child.name}` },
  ];
  return (
    <div style={{ marginBottom: 14 }}>
      <div className={f.head}>
        <span className={f.title}>
          {child.name} <span className={f.tag}>{g("ولد", "بنت")}</span>
        </span>
        <Link href={`/rafiq/family/${familyId}`} className={f.back}>
          العائلة ←
        </Link>
      </div>
      <p className={hl.muted} style={{ margin: "4px 4px 10px" }}>
        {canEdit
          ? `${p("تسمّع", "تسمّعين")} مع ${child.name} ${p("وتعدّل", "وتعدّلين")} ${g("حفظه ومتابعته", "حفظها ومتابعتها")}.`
          : "مشاهدة فقط — يمنح مؤسِّس العائلة صلاحية التعديل."}
      </p>
      <div className={hl.actionsRow} style={{ margin: "0 4px", flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={on === t.key ? hl.primaryBtn : hl.ghostBtn}
            style={{ textDecoration: "none" }}
            aria-current={on === t.key ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
