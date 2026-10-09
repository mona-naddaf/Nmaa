import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/require";
import { getOfflineAccess } from "@/lib/offline-sheet/access";
import { MAX_DAYS_BACK } from "@/lib/offline-sheet/dates";
import { OfflineSheetView } from "./OfflineSheetView";

export default async function OfflineSheetPage() {
  const session = await requireSession();
  const access = await getOfflineAccess(session);
  if (!access) redirect("/students");

  return (
    <OfflineSheetView
      groups={access.groups.map((g) => ({ id: g.id, name: g.name }))}
      viewerGender={access.viewerGender}
      maxDaysBack={MAX_DAYS_BACK}
    />
  );
}
