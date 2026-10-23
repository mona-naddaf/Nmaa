import { redirect } from "next/navigation";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { getMemorization } from "@/lib/rafiq/memorization";
import { RafiqHome } from "./RafiqHome";
import { getCommitment } from "@/lib/rafiq/commitment";
import { prisma } from "@/lib/db";
import { rafiqTajweedSummary } from "@/lib/rafiq/tajweed";
import { guideEnabled } from "@/lib/guide/enabled";
import { ResumeCard } from "./ResumeCard";

// «صفحتي»: where she stands, her progress, recording a session, her
// mistakes, review reminders and her session history. Before she has a plan,
// she's sent to set one up. ?later=1: back from «إكمال الأسئلة لاحقًا».
export default async function RafiqHomePage({ searchParams }: PageProps<"/rafiq">) {
  const user = await requireRafiqUser();
  const data = await getMemorization(user.id);
  if (!data) redirect("/rafiq/plan");
  const { mutashabihatEnabled, tajweedDetailEnabled } = await prisma.rafiqUser.findUniqueOrThrow({
    where: { id: user.id },
    select: { mutashabihatEnabled: true, tajweedDetailEnabled: true },
  });
  return (
    <RafiqHome
      data={data}
      gender={user.gender}
      commitment={await getCommitment(user.id)}
      similar={mutashabihatEnabled}
      tajweed={tajweedDetailEnabled}
      tajweedSummary={await rafiqTajweedSummary(user.id)}
      guide={guideEnabled() ? <ResumeCard gender={user.gender} later={(await searchParams).later === "1"} /> : undefined}
    />
  );
}
