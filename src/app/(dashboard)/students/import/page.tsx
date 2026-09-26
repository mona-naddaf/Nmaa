import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require";
import { ImportForm } from "./ImportForm";

export default async function ImportStudentsPage() {
  const session = await requireAdmin();
  const [admin, groupCount] = await Promise.all([
    prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } }),
    prisma.group.count({ where: { courseId: session.courseId } }),
  ]);

  return <ImportForm viewerGender={admin?.gender ?? null} hasGroups={groupCount > 0} />;
}
