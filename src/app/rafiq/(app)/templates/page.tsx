import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { listTemplates } from "@/lib/rafiq/templates";
import { TemplateBank } from "./TemplateBank";
import { guideEnabled } from "@/lib/guide/enabled";

export default async function RafiqTemplatesPage({ searchParams }: PageProps<"/rafiq/templates">) {
  const user = await requireRafiqUser();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 100) : "";
  const { agendaEnabled } = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: user.id }, select: { agendaEnabled: true } });
  // her active item titles: «استخدام الجدول» counts only what would really be added
  const mine = (await prisma.rafiqTrackerItem.findMany({ where: { userId: user.id, archivedAt: null }, select: { title: true } })).map((i) => i.title);
  return <TemplateBank cards={await listTemplates(user.id, query, agendaEnabled)} mine={mine} query={query} g={user.gender === "FEMALE" ? "GIRLS" : "BOYS"} {...(guideEnabled() ? { guided: true } : {})} />;
}
