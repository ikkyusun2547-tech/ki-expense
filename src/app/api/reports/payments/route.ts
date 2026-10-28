import writeExcelFile from "write-excel-file/node";
import { centerCode } from "@/lib/centers/phone";
import { paymentsFileName, paymentsPrintSetup, paymentsSheet, paymentsSheetOptions } from "@/lib/reports/paymentsReport";
import { WORKBOOK_FONT, XLSX_CONTENT_TYPE } from "@/lib/reports/xlsx";
import { formatThaiDateTime, fromISODate, toISODate, todayISO } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";

// ดาวน์โหลดสรุปการจ่ายรายเดือนเป็นไฟล์ Excel — ?month=YYYY-MM ตามวันที่จ่าย, ไม่ระบุ = เดือนนี้
export async function GET(request: Request) {
  await requireRole("ACCOUNTING", "ADMIN");

  const param = new URL(request.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? param : todayISO().slice(0, 7);
  const [y, m] = month.split("-").map(Number);

  const rows = await db.request.findMany({
    where: {
      status: "PAID",
      deletedAt: null,
      imported: false, // ใบย้อนหลังที่นำเข้าจากตารางเดิมไม่ได้จ่ายผ่านระบบ
      paidDate: { gte: fromISODate(`${month}-01`), lt: new Date(Date.UTC(y, m, 1)) },
    },
    orderBy: [{ paidDate: "asc" }, { createdAt: "asc" }],
    include: { center: { select: { kind: true, name: true, customerCode: true } } },
  });

  const sheet = paymentsSheet(
    month,
    rows.map((r) => ({
      paidDate: toISODate(r.paidDate!),
      kind: r.center.kind,
      centerName: r.center.name,
      customerCode: centerCode(r.center),
      invoiceNo: r.invoiceNo,
      periodStart: toISODate(r.periodStart),
      periodEnd: toISODate(r.periodEnd),
      dueDate: toISODate(r.dueDate),
      amount: r.amount,
      paymentRef: r.paymentRef ?? "",
      approverName: r.approverName,
    })),
    `${formatThaiDateTime(new Date())} น.`,
  );
  const file = await writeExcelFile(sheet, paymentsSheetOptions(month), {
    ...WORKBOOK_FONT,
    features: [paymentsPrintSetup(month)],
  }).toBuffer();

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(paymentsFileName(month))}`,
      "Cache-Control": "private, no-store",
    },
  });
}
