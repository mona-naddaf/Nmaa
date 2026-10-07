import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { normalizeArabic } from "@/lib/resources/normalize";

// Reading the tracker template bank. The publisher is never sent to anyone:
// bank queries select createdByRafiqId only to work out "is this mine" on
// the server. Hidden templates (3 open reports) show only to their publisher.

export interface TemplateCard {
  id: string;
  title: string;
  description: string | null;
  suggested: boolean;
  useCount: number;
  items: { title: string; value: number; days: number }[];
  own: boolean;
  hidden: boolean;
  reportedByMe: boolean;
}

export const templateSearchKey = (title: string, description: string | null) => normalizeArabic(`${title} ${description ?? ""}`);

const LIST_MAX = 60;

/** The bank as one Rafiq user sees it: suggested first, then newest. */
export async function listTemplates(viewerId: string, query: string): Promise<TemplateCard[]> {
  const q = normalizeArabic(query ?? "");
  const where: Prisma.TrackerTemplateWhereInput = {
    AND: [
      { OR: [{ hiddenAt: null }, { createdByRafiqId: viewerId }] },
      ...(q ? q.split(" ").map((word) => ({ searchKey: { contains: word } })) : []),
    ],
  };
  const rows = await prisma.trackerTemplate.findMany({
    where,
    orderBy: [{ suggested: "desc" }, { createdAt: "desc" }],
    take: LIST_MAX,
    select: {
      id: true,
      title: true,
      description: true,
      suggested: true,
      useCount: true,
      hiddenAt: true,
      createdByRafiqId: true,
      items: { orderBy: { sortOrder: "asc" }, select: { title: true, value: true, days: true } },
      reports: { where: { resolvedAt: null, reporterRafiqId: viewerId }, select: { id: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    suggested: r.suggested,
    useCount: r.useCount,
    items: r.items,
    own: r.createdByRafiqId === viewerId,
    hidden: r.hiddenAt !== null,
    reportedByMe: r.reports.length > 0,
  }));
}
