import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { buildImportTemplate, type TemplateVariant } from "@/lib/students/import-template";

// Supervisor-only, like the import itself. Built fresh on every request so
// the group dropdown matches the course's groups right now.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return new NextResponse("غير مصرّح", { status: 403 });
  }

  const variant: TemplateVariant = request.nextUrl.searchParams.get("variant") === "boys" ? "boys" : "girls";

  const [groups, admin] = await Promise.all([
    prisma.group.findMany({ where: { courseId: session.courseId }, orderBy: { sortOrder: "asc" }, select: { name: true, gender: true } }),
    prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } }),
  ]);
  if (groups.length === 0) {
    return new NextResponse("لا توجد مجموعات في الدورة بعد", { status: 409 });
  }

  const variantGender = variant === "girls" ? "GIRLS" : "BOYS";
  const buffer = await buildImportTemplate({
    variant,
    groupNames: groups.map((g) => g.name),
    exampleGroupName: (groups.find((g) => g.gender === variantGender) ?? groups[0]).name,
    supervisorGender: admin?.gender ?? null,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="namaa-import-template-${variant}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
