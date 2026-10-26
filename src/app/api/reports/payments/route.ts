import { centerCode } from "@/lib/centers/phone";
import { paymentsCsv } from "@/lib/reports/paymentsCsv";
import { fromISODate, toISODate, todayISO } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";

// ดาวน์โหลดสรุปการจ่ายรายเดือน (CSV เปิดด้วย Excel) — ?month=YYYY-MM ตามวันที่จ่าย, ไม่ระบุ = เดือนนี้
export async function GET(request: Request) {
  await requireRole("ACCOUNTING", "ADMIN");

  const param = new URL(request.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? param : todayISO().slice(0, 7);
  const [y, m] = month.split("-").map(Number);

  const rows = await db.request.findMany({
    where: {
      status: "PAID",
      deletedAt: null,
      paidDate: { gte: fromISODate(`${month}-01`), lt: new Date(Date.UTC(y, m, 1)) },
    },
    orderBy: [{ paidDate: "asc" }, { createdAt: "asc" }],
    include: { center: { select: { kind: true, name: true, customerCode: true } } },
  });

  const csv = paymentsCsv(
    month,
    rows.map((r) => ({
      paidDate: toISODate(r.paidDate!),
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
  );
  const fileName = encodeURIComponent(`สรุปการจ่าย-${y + 543}-${String(m).padStart(2, "0")}.csv`);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
      "Cache-Control": "private, no-store",
    },
  });
}
