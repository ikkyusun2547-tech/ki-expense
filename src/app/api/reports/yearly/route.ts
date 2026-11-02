import writeExcelFile from "write-excel-file/node";
import type { ServiceKind } from "@/generated/prisma/enums";
import { centerCode } from "@/lib/centers/phone";
import { yearlyFileName, yearlyPrintSetup, yearlyReport } from "@/lib/reports/yearlyReport";
import { WORKBOOK_FONT, XLSX_CONTENT_TYPE } from "@/lib/reports/xlsx";
import { formatThaiDateTime, toISODate, todayISO } from "@/lib/thai/date";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

// ดาวน์โหลดตารางรายปี (แทนตารางสรุปที่เคยเขียนมือ) — ทุกบทบาทที่ล็อกอิน (เหมือนหน้าศูนย์ & เบอร์)
// ?kind=INTERNET|PHONE&year=YYYY (ค.ศ.) ไม่ระบุ = ค่าอินเทอร์เน็ต ปีนี้
export async function GET(request: Request) {
  await requireUser();
  const params = new URL(request.url).searchParams;

  const kind: ServiceKind = params.get("kind") === "PHONE" ? "PHONE" : "INTERNET";
  const yearParam = Number(params.get("year"));
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2200 ? yearParam : Number(todayISO().slice(0, 4));

  const requests = await db.request.findMany({
    where: {
      deletedAt: null,
      center: { kind },
      dueDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
    },
    select: { centerId: true, amount: true, dueDate: true, periodStart: true, periodEnd: true, status: true },
  });
  // ศูนย์ที่ใช้งานอยู่ทั้งหมด + ศูนย์ที่ย้าย/ปิดแล้วแต่มีใบเบิกในปีนั้น; เรียงตามลำดับที่เพิ่มเข้าทะเบียน
  const centers = await db.center.findMany({
    where: { kind, OR: [{ status: "ACTIVE" }, { id: { in: [...new Set(requests.map((r) => r.centerId))] } }] },
    orderBy: [{ createdAt: "asc" }, { customerCode: "asc" }],
    select: { id: true, kind: true, name: true, customerCode: true, serviceNumber: true, status: true },
  });

  const report = yearlyReport(
    kind,
    year,
    centers.map((c) => ({ id: c.id, name: c.name, code: centerCode(c), serviceNumber: c.serviceNumber, status: c.status })),
    requests.map((r) => ({
      centerId: r.centerId,
      amount: r.amount,
      dueDate: toISODate(r.dueDate),
      periodStart: toISODate(r.periodStart),
      periodEnd: toISODate(r.periodEnd),
      paid: r.status === "PAID",
    })),
    `${formatThaiDateTime(new Date())} น.`,
  );
  const file = await writeExcelFile(report.sheet, report.options, {
    ...WORKBOOK_FONT,
    features: [yearlyPrintSetup(kind, year)],
  }).toBuffer();

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(yearlyFileName(kind, year))}`,
      "Cache-Control": "private, no-store",
    },
  });
}
