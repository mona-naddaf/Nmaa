import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildImportTemplate, type TemplateVariant } from "@/lib/students/import-template";
import { getImportAccess } from "@/lib/students/import-access";
import { fieldLabel, isMultilineField } from "@/lib/students/extra-info-rules";

// For whoever may import (getImportAccess). Built fresh on every request so
// the group dropdown and the extra-info columns match the course right now:
// the supervisor gets every group and enabled field, a teacher only her
// groups and the fields her add form shows.
export async function GET(request: NextRequest) {
  const session = await getSession();
  const access = session ? await getImportAccess(session) : null;
  if (!access) {
    return new NextResponse("غير مصرّح", { status: 403 });
  }

  const variant: TemplateVariant = request.nextUrl.searchParams.get("variant") === "boys" ? "boys" : "girls";

  const { groups } = access;
  if (groups.length === 0) {
    return new NextResponse("لا توجد مجموعات متاحة بعد", { status: 409 });
  }

  const variantGender = variant === "girls" ? "GIRLS" : "BOYS";
  const buffer = await buildImportTemplate({
    variant,
    groupNames: groups.map((g) => g.name),
    exampleGroupName: (groups.find((g) => g.gender === variantGender) ?? groups[0]).name,
    viewerGender: access.viewerGender,
    infoColumns: access.infoFields.map((f) => ({
      label: fieldLabel(f, variantGender),
      required: f.required,
      multiline: isMultilineField(f),
    })),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ala-mukth-import-template-${variant}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
