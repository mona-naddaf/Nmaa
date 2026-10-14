import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { listTemplates } from "@/lib/rafiq/templates";
import { TemplateBank } from "./TemplateBank";

export default async function RafiqTemplatesPage({ searchParams }: PageProps<"/rafiq/templates">) {
  const user = await requireRafiqUser();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 100) : "";
  const { agendaEnabled } = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: user.id }, select: { agendaEnabled: true } });
  return <TemplateBank cards={await listTemplates(user.id, query, agendaEnabled)} query={query} g={user.gender === "FEMALE" ? "GIRLS" : "BOYS"} />;
}
