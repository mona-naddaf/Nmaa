import { redirect } from "next/navigation";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { getRafiqHomeLog } from "@/lib/rafiq/home-log";
import { RafiqPractice } from "./RafiqPractice";
import { prisma } from "@/lib/db";
import { SimilarScope } from "../../SimilarScope";
import { rafiqMarkDetails, rafiqMarkFlags } from "@/lib/rafiq/home-mistakes";
import { getGuide } from "@/lib/guide/state";
import { introsFor } from "@/lib/guide/lines";
import { IntroLine } from "../../guide/IntroLine";
import { deleteSegmentAction, finishSegmentAction, markSpotAction, markWordAction, resolveSpotAction, tapAction, undoTapAction } from "../actions";

// One active passage of hers: big counters and the ayat. Anything else (not
// hers, finished) goes back to the list. With guidance on: the page's intro
// lines above the ayat.
export default async function RafiqSegmentPage({ params }: PageProps<"/rafiq/home-log/[id]">) {
  const { id } = await params;
  const user = await requireRafiqUser();
  const log = await getRafiqHomeLog(user.id, { pastLimit: 0 });
  const segment = log.active.find((s) => s.id === id);
  if (!segment) redirect("/rafiq/home-log");
  const { mutashabihatEnabled, tajweedDetailEnabled } = await prisma.rafiqUser.findUniqueOrThrow({
    where: { id: user.id },
    select: { mutashabihatEnabled: true, tajweedDetailEnabled: true },
  });
  const guide = await getGuide();
  return (
    // «المتشابهات» marks (her setting)
    <SimilarScope on={mutashabihatEnabled}>
      <RafiqPractice
        segment={segment}
        groupGender={user.gender === "FEMALE" ? "GIRLS" : "BOYS"}
        actions={{ tap: tapAction, undoTap: undoTapAction, finish: finishSegmentAction, remove: deleteSegmentAction }}
        listHref="/rafiq/home-log"
        initialFlags={await rafiqMarkFlags(user.id, segment.surahNumber, segment.fromAyah, segment.toAyah)}
        mark={markWordAction}
        {...(guide
          ? { beforeAyat: <IntroLine candidates={introsFor("segment", { features: guide.facts.features, city: guide.facts.city })} here={["mutashabihat", "verseNotes"]} /> }
          : {})}
        // «أخطاء التجويد المفصّلة» (her setting): letters and gaps too
        detail={
          tajweedDetailEnabled
            ? {
                initial: await rafiqMarkDetails(user.id, segment.surahNumber, segment.fromAyah, segment.toAyah),
                save: markSpotAction,
                master: resolveSpotAction,
              }
            : undefined
        }
      />
    </SimilarScope>
  );
}
