import "server-only";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth/session";
import { supervisorNoun } from "@/lib/text/gender";
import { createdBy, isCreator, isSiteOwner, viewerOf } from "./access";
import { normalizeArabic, tagKey } from "./normalize";
import { urlHost } from "./validate";

// The ONLY place bank data is read for display. Every query selects its
// fields explicitly; the creator's identity (and through it, the course) is
// loaded only when the viewer is the site owner. Creator ids are used here to
// work out "mine"/"editable" and are never put in what's returned.

export const PAGE_SIZE = 24;

export type ResourceCard = {
  id: string;
  url: string;
  host: string;
  title: string;
  description: string | null;
  ageFrom: number;
  ageTo: number;
  typeId: string;
  typeName: string;
  tags: { name: string; key: string }[];
  mine: boolean;
  editable: boolean;
  // hidden pending review: shown only to its creator and the site owner
  hidden: boolean;
  // site owner only
  creator?: string;
  openReports?: number;
};

export type BankFilters = { q?: string; typeId?: string; tag?: string; age?: number; mine?: boolean; page?: number };

const CREATOR_SELECT = {
  createdByAdmin: { select: { gender: true, course: { select: { name: true } } } },
  createdByTeacher: { select: { name: true, course: { select: { name: true } } } },
} as const;

type CreatorRow = {
  createdByAdmin: { gender: "MALE" | "FEMALE" | null; course: { name: string } | null } | null;
  createdByTeacher: { name: string; course: { name: string } } | null;
};

/** "مشرفة دورة «الزهرات»" / "سارة — دورة «الزهرات»" / account gone. Site owner only. */
export function creatorLabel(r: CreatorRow): string {
  if (r.createdByAdmin) return `${supervisorNoun(r.createdByAdmin.gender)} دورة «${r.createdByAdmin.course?.name ?? "—"}»`;
  if (r.createdByTeacher) return `${r.createdByTeacher.name} — دورة «${r.createdByTeacher.course.name}»`;
  return "حساب محذوف";
}

export async function listResources(session: Session, filters: BankFilters) {
  const viewer = viewerOf(session);
  const owner = await isSiteOwner(session);
  const mineWhere = createdBy(viewer);

  const and: object[] = [];
  if (filters.mine) and.push(mineWhere);
  // hidden resources: only their creator (and the owner) still see them
  else if (!owner) and.push({ OR: [{ hiddenAt: null }, mineWhere] });
  const q = filters.q ? normalizeArabic(filters.q) : "";
  if (q) and.push({ searchKey: { contains: q } });
  if (filters.typeId) and.push({ typeId: filters.typeId });
  const tag = filters.tag ? tagKey(filters.tag) : "";
  if (tag) and.push({ tags: { some: { tag: { key: tag } } } });
  if (filters.age) and.push({ ageFrom: { lte: filters.age }, ageTo: { gte: filters.age } });

  const page = Math.max(1, Math.min(50, filters.page ?? 1));
  const rows = await prisma.resource.findMany({
    where: { AND: and },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: page * PAGE_SIZE + 1,
    select: {
      id: true,
      url: true,
      title: true,
      description: true,
      ageFrom: true,
      ageTo: true,
      hiddenAt: true,
      createdByAdminId: true,
      createdByTeacherId: true,
      type: { select: { id: true, name: true } },
      tags: { select: { tag: { select: { name: true, key: true } } } },
      ...(owner ? { ...CREATOR_SELECT, _count: { select: { reports: { where: { resolvedAt: null } } } } } : {}),
    },
  });

  const cards: ResourceCard[] = rows.slice(0, page * PAGE_SIZE).map((r) => {
    const mine = isCreator(viewer, r);
    const card: ResourceCard = {
      id: r.id,
      url: r.url,
      host: urlHost(r.url),
      title: r.title,
      description: r.description,
      ageFrom: r.ageFrom,
      ageTo: r.ageTo,
      typeId: r.type.id,
      typeName: r.type.name,
      tags: r.tags.map((t) => t.tag),
      mine,
      editable: mine || owner,
      hidden: r.hiddenAt !== null,
    };
    if (owner) {
      const o = r as typeof r & CreatorRow & { _count: { reports: number } };
      card.creator = creatorLabel(o);
      card.openReports = o._count.reports;
    }
    return card;
  });
  return { cards, hasMore: rows.length > page * PAGE_SIZE, page, owner };
}

export async function listResourceTypes() {
  return prisma.resourceType.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
}

/** Existing tags matching what's being typed, most-used first. Tags aren't private. */
export async function suggestTags(text: string, limit = 8) {
  const key = tagKey(text);
  if (!key) return [];
  const tags = await prisma.tag.findMany({
    // only tags still in use: an orphaned tag isn't worth reusing
    where: { key: { contains: key }, resources: { some: {} } },
    select: { name: true, key: true, _count: { select: { resources: true } } },
    take: 50,
  });
  return tags
    .map((t) => ({ name: t.name, key: t.key, count: t._count.resources, starts: t.key.startsWith(key) }))
    .sort((a, b) => Number(b.starts) - Number(a.starts) || b.count - a.count || a.name.localeCompare(b.name, "ar"))
    .slice(0, limit)
    .map(({ name, key, count }) => ({ name, key, count }));
}
