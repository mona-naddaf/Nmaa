import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getApprovalQueue, getGroupTracker, getStaffTrackerItems } from "@/lib/tracker/data";
import { getStaffScope, scopedGroups } from "@/lib/staff-scope";
import { TrackerStaffView } from "./TrackerStaffView";
import { coursePlace } from "@/lib/prayer/place-data";
import { courseExcuseAllowed, groupSees, groupTrackerExcuse, staffViewer } from "@/lib/excuse/course-data";
import { staffSetsItemExcuse } from "@/lib/excuse/visibility";

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

  // «أيام العذر»: the overview's scores for everyone; «معذورة» and the item setting only for who may
  const viewer = await staffViewer(scope.session);
  const { excuseEnabled } = await prisma.course.findUniqueOrThrow({ where: { id: scope.courseId }, select: { excuseEnabled: true } });
  const excuseItems =
    excuseEnabled &&
    (await courseExcuseAllowed(scope.courseId)) &&
    groupSees(viewer, group.id, group.gender) &&
    (viewer.kind === "SUPERVISOR" || viewer.kind === "TEACHER") &&
    staffSetsItemExcuse(viewer.gender);

  const [queue, overview, items, students, groupExcuse] = await Promise.all([
    getApprovalQueue(scope),
    getGroupTracker(group.id),
    getStaffTrackerItems(scope, group.id, excuseItems),
    prisma.student.findMany({ where: { groupId: group.id, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    groupTrackerExcuse(group.id, viewer),
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
      overview={{ ...overview, ...groupExcuse }}
      excuseItems={excuseItems}
      items={items}
      students={students}
      agenda={scope.trackerAgendaEnabled}
      place={scope.trackerAgendaEnabled ? await coursePlace(scope.courseId) : null}
    />
  );
}
