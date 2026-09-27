import { requireAdmin } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { getParentCodeRows } from "@/lib/parent/codes";
import { ParentCodesView } from "./ParentCodesView";

export default async function ParentCodesPage() {
  const session = await requireAdmin();
  const [{ rows, courseGender }, admin] = await Promise.all([
    getParentCodeRows(session.courseId),
    prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } }),
  ]);
  return <ParentCodesView rows={rows} courseGender={courseGender} viewerGender={admin?.gender ?? null} />;
}
