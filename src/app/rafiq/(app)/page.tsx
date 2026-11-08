import { redirect } from "next/navigation";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { getMemorization } from "@/lib/rafiq/memorization";
import { RafiqHome } from "./RafiqHome";
import { getCommitment } from "@/lib/rafiq/commitment";
import { prisma } from "@/lib/db";
import { rafiqTajweedSummary } from "@/lib/rafiq/tajweed";
import { getGuide } from "@/lib/guide/state";
import { checklistFacts, hasCommitDays, hasFlaggedWords } from "@/lib/guide/page-facts";
import { commitmentChosen } from "@/lib/guide/lines";
import { ResumeCard } from "./ResumeCard";
import { mushafViewFor } from "@/lib/mushaf/enabled";
import { Checklist } from "./guide/Checklist";
import { loadPauses, ownExcuse, pausedNow } from "@/lib/excuse/rafiq-data";
import { highlightOn } from "@/lib/highlight/server";

// «صفحتي»: where she stands, her progress, recording a session, her
// mistakes, review reminders and her session history. Before she has a plan,
// she's sent to set one up. ?later=1: back from «إكمال الأسئلة لاحقًا».
// With guidance on: the resume card, then «الخطوات الأولى» (a new account's),
// under where she stands.
export default async function RafiqHomePage({ searchParams }: PageProps<"/rafiq">) {
  const user = await requireRafiqUser();
  const data = await getMemorization(user.id);
  if (!data) redirect("/rafiq/plan");
  const { mutashabihatEnabled, tajweedDetailEnabled } = await prisma.rafiqUser.findUniqueOrThrow({
    where: { id: user.id },
    select: { mutashabihatEnabled: true, tajweedDetailEnabled: true },
  });
  const guide = await getGuide();
  // «أيام العذر»: a woman's own paused days (EXCUSE_ENABLED); nothing of it is loaded otherwise
  const excuse = await ownExcuse(user.id);
  return (
    <RafiqHome
      data={data}
      gender={user.gender}
      mushaf={mushafViewFor(user.email)}
      highlight={(await highlightOn()) ? { gender: user.gender } : undefined}
      commitment={await getCommitment(user.id)}
      similar={mutashabihatEnabled}
      tajweed={tajweedDetailEnabled}
      tajweedSummary={await rafiqTajweedSummary(user.id)}
      {...(excuse.show ? { paused: await loadPauses(user.id), pausedNow: await pausedNow(user.id) } : {})}
      guide={
        guide
          ? {
              slot: (
                <>
                  <ResumeCard gender={user.gender} later={(await searchParams).later === "1"} />
                  {guide.isNew && <Checklist facts={await checklistFacts(user.id)} />}
                </>
              ),
              flaggedWords: await hasFlaggedWords(user.id),
              // read only while its «أيام العذر» line could show
              commitSet: guide.facts.excuse === false && commitmentChosen({ savedDays: await hasCommitDays(user.id), loggedSessions: data.loggedSessions }),
            }
          : undefined
      }
    />
  );
}
