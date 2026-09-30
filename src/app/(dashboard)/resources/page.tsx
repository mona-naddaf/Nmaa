import { requireSession } from "@/lib/auth/require";
import { listResources, listResourceTypes } from "@/lib/resources/data";
import { ResourceBank } from "./ResourceBank";

// Staff only (proxy.ts sends anyone without a staff session away; parents
// and the public board have their own cookies and routes). Shared by every
// course — see src/lib/resources/data.ts for what is and isn't loaded.
export default async function ResourcesPage({ searchParams }: PageProps<"/resources">) {
  const session = await requireSession();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  const ageNum = Number(one(sp.age));
  const age = Number.isInteger(ageNum) && ageNum >= 1 && ageNum <= 25 ? ageNum : undefined;
  const pageNum = Number(one(sp.page));
  const filters = {
    q: one(sp.q).slice(0, 100),
    typeId: one(sp.type).slice(0, 40),
    tag: one(sp.tag).slice(0, 40),
    age,
    mine: one(sp.mine) === "1",
    page: Number.isInteger(pageNum) && pageNum > 1 ? pageNum : 1,
  };

  const [{ cards, hasMore, page, owner }, types] = await Promise.all([listResources(session, filters), listResourceTypes()]);

  return (
    <ResourceBank
      cards={cards}
      hasMore={hasMore}
      types={types}
      isOwner={owner}
      filters={{ q: filters.q, type: filters.typeId, tag: filters.tag, age: age ? String(age) : "", mine: filters.mine, page }}
    />
  );
}
