import Link from "next/link";
import hl from "@/components/home-log/home-log.module.css";
import f from "../../../family.module.css";

// The top of an adult's view of one child: whose page it is, what the adult
// may do there, and the child's two pages (step 3).
export function ChildHeader({
  familyId,
  child,
  canEdit,
  on,
  you,
}: {
  familyId: string;
  child: { id: string; name: string; gender: "MALE" | "FEMALE" };
  canEdit: boolean;
  on: "page" | "tracker";
  // the adult looking
  you: "MALE" | "FEMALE";
}) {
  const p = (m: string, fem: string) => (you === "FEMALE" ? fem : m);
  const g = (m: string, fem: string) => (child.gender === "FEMALE" ? fem : m);
  const base = `/rafiq/family/${familyId}/child/${child.id}`;
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
      <div className={hl.actionsRow} style={{ margin: "0 4px" }}>
        <Link href={base} className={on === "page" ? hl.primaryBtn : hl.ghostBtn} style={{ textDecoration: "none" }} aria-current={on === "page" ? "page" : undefined}>
          {g("صفحته", "صفحتها")}
        </Link>
        <Link href={`${base}/tracker`} className={on === "tracker" ? hl.primaryBtn : hl.ghostBtn} style={{ textDecoration: "none" }} aria-current={on === "tracker" ? "page" : undefined}>
          جدول المتابعة
        </Link>
      </div>
    </div>
  );
}
