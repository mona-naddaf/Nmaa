import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { getLeaderboardData } from "@/lib/leaderboard/data";
import { Leaderboard } from "@/components/leaderboard/Leaderboard";

export default async function LeaderboardPage() {
  const session = await requireSession();
  const [{ students, dailyEntries }, groups] = await Promise.all([
    getLeaderboardData(session.courseId),
    prisma.group.findMany({ where: { courseId: session.courseId }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <Leaderboard
      students={students}
      groups={groups.map((g) => ({ id: g.id, name: g.name }))}
      dailyEntries={dailyEntries}
    />
  );
}
