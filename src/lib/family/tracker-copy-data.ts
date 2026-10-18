import "server-only";
import { prisma } from "@/lib/db";

// «العائلة»: the children an adult may add tracker items to or copy a
// tracker to — every child of each family where she is the founder or has
// edit rights. The actions check every requested id against this list; the
// tracker pages show it (grouped by family).

export type CopyChild = { id: string; name: string; gender: "MALE" | "FEMALE" };
export type CopyFamily = { id: string; name: string; children: CopyChild[] };

export async function editableChildren(adultId: string): Promise<CopyFamily[]> {
  const families = await prisma.family.findMany({
    where: { members: { some: { userId: adultId } }, OR: [{ founderId: adultId }, { members: { some: { userId: adultId, canEditChildren: true } } }] },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, children: { where: { kind: "CHILD" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, gender: true } } },
  });
  return families.map((f) => ({ id: f.id, name: f.name, children: f.children.map((c) => ({ id: c.id, name: c.name ?? "", gender: c.gender })) }));
}
