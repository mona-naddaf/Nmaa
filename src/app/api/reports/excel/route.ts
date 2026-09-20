import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { resolveReportScope, getReportRows } from "@/lib/reports/data";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { session, resolved } = await resolveReportScope(params);
  const rows = await getReportRows(session.courseId, resolved);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("التقرير", { views: [{ rightToLeft: true }] });

  sheet.columns = [
    { header: "الطالبة", key: "name", width: 22 },
    { header: "المجموعة", key: "group", width: 18 },
    { header: "إجمالي الصفحات", key: "pages", width: 16 },
    { header: "أيام الحضور", key: "attendance", width: 14 },
    { header: "إجمالي النقاط", key: "points", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const r of rows) {
    sheet.addRow({ name: r.name, group: r.groupName, pages: r.totalPages, attendance: r.attendanceDays, points: r.totalPoints });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `تقرير-${resolved.from.toISOString().slice(0, 10)}-${resolved.to.toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
