import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getApprovalQueue, getGroupTracker, getStaffTrackerItems } from "@/lib/tracker/data";
import { getStaffScope, scopedGroups } from "@/lib/staff-scope";
import { TrackerStaffView } from "./TrackerStaffView";

// Staff: per group — the approval queue for students' own items, the week
// overview table and the group's items. Refused (not just hidden) while the
// course has the tracker or student login off.
export default async function TrackerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const scope = await getStaffScope("tracker");
  if (!scope) redirect("/students");
  const params = await searchParams;

  const groups = await scopedGroups(scope);
  if (groups.length === 0) redirect("/students");
  const group = groups.find((g) => g.id === params.group) ?? groups[0];

  const [queue, overview, items, students] = await Promise.all([
    getApprovalQueue(scope),
    getGroupTracker(group.id),
    getStaffTrackerItems(scope, group.id),
    prisma.student.findMany({ where: { groupId: group.id, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const pendingByGroup = new Map<string, number>();
  for (const q of queue) {
    const gid = q.student.groupId;
    pendingByGroup.set(gid, (pendingByGroup.get(gid) ?? 0) + 1);
  }
  const withCounts = groups.map((g) => ({ ...g, pending: pendingByGroup.get(g.id) ?? 0 }));

  return (
    <TrackerStaffView
      groups={withCounts}
      group={withCounts.find((g) => g.id === group.id)!}
      queue={queue}
      overview={overview}
      items={items}
      students={students}
    />
  );
}
