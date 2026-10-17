import { requireFamilyChild } from "@/lib/family/child-session";
import { childFlags, childHomeData, familyAdults } from "@/lib/family/child-pages";
import { pickByPerson } from "@/lib/text/gender";
import { RafiqHome } from "@/app/rafiq/(app)/RafiqHome";
import hl from "@/components/home-log/home-log.module.css";

// «صفحتي» of a child («العائلة»): the Rafiq page, as herself — her position
// (and goal, with its switch), recording her own sessions (no word marks:
// those come when an adult recites with her), her words to review
// (read-only), her streak and review reminders (with their switches) and her
// log.
export default async function ChildHomePage() {
  const child = await requireFamilyChild();
  const flags = await childFlags(child.id);
  const { data, commitment, tajweedSummary } = await childHomeData(child.id, flags);
  const p = (m: string, f: string) => pickByPerson(child.gender, { m, f });
  return (
    <>
      <div className={hl.sectionTitle} style={{ margin: "0 4px 12px" }}>
        <span style={{ fontSize: 17, color: "var(--ink)" }}>أهلًا يا {child.name} 🌱</span>
      </div>
      {data ? (
        <RafiqHome
          data={data}
          gender={child.gender}
          commitment={commitment}
          similar={flags.mutashabihat}
          tajweedSummary={tajweedSummary}
          scope={{ viewer: "child", adults: await familyAdults(child.familyId), streak: flags.streak }}
        />
      ) : (
        // every child gets a plan when added; kept for safety
        <div className={hl.section}>
          <div className={hl.empty}>لم {p("يُحدِّد", "تُحدِّد")} أهلك خطة حفظك بعد.</div>
        </div>
      )}
    </>
  );
}
