import { redirect } from "next/navigation";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { getRafiqHomeLog } from "@/lib/rafiq/home-log";
import { RafiqPractice } from "./RafiqPractice";
import { rafiqMarkFlags } from "@/lib/rafiq/home-mistakes";
import { deleteSegmentAction, finishSegmentAction, markWordAction, tapAction, undoTapAction } from "../actions";

// One active passage of hers: big counters and the ayat. Anything else (not
// hers, finished) goes back to the list.
export default async function RafiqSegmentPage({ params }: PageProps<"/rafiq/home-log/[id]">) {
  const { id } = await params;
  const user = await requireRafiqUser();
  const log = await getRafiqHomeLog(user.id, { pastLimit: 0 });
  const segment = log.active.find((s) => s.id === id);
  if (!segment) redirect("/rafiq/home-log");
  return (
    <RafiqPractice
      segment={segment}
      groupGender={user.gender === "FEMALE" ? "GIRLS" : "BOYS"}
      actions={{ tap: tapAction, undoTap: undoTapAction, finish: finishSegmentAction, remove: deleteSegmentAction }}
      listHref="/rafiq/home-log"
      initialFlags={await rafiqMarkFlags(user.id, segment.surahNumber, segment.fromAyah, segment.toAyah)}
      mark={markWordAction}
    />
  );
}
