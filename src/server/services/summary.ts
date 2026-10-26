import "server-only";
import { compareSummaries, summarizeCenter, type CenterSummaryResult } from "@/lib/rules/centerSummary";
import { fromISODate, toISODate, type ISODate } from "@/lib/thai/date";
import { db } from "@/server/db";

export type CenterSummaryRow = CenterSummaryResult & {
  center: { id: string; customerCode: string; name: string; dueDay: number };
};

// ตารางสรุปรายศูนย์ — เฉพาะศูนย์ (ค่าอินเทอร์เน็ต) ที่ใช้งานอยู่ (ศูนย์ย้าย/ปิด เบิกไม่ได้ จึงไม่ต้องติดตาม)
// ใช้ใบเบิกที่วันครบกำหนดอยู่ในเดือนนี้หรือเดือนหน้าเท่านั้น
export async function getCenterSummaries(today: ISODate): Promise<CenterSummaryRow[]> {
  const [y, m] = today.split("-").map(Number);
  const from = fromISODate(`${y}-${String(m).padStart(2, "0")}-01`);
  const until = new Date(Date.UTC(y, m + 1, 1)); // วันแรกของเดือนถัดจากเดือนหน้า

  const centers = await db.center.findMany({
    where: { kind: "INTERNET", status: "ACTIVE" },
    orderBy: { customerCode: "asc" },
    include: {
      requests: {
        where: { deletedAt: null, dueDate: { gte: from, lt: until } },
        select: { id: true, dueDate: true, status: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return centers
    .map((c) => ({
      center: { id: c.id, customerCode: c.customerCode, name: c.name, dueDay: c.dueDay },
      ...summarizeCenter(
        c.dueDay,
        c.requests.map((r) => ({ id: r.id, dueDate: toISODate(r.dueDate), status: r.status })),
        today,
      ),
    }))
    .sort(compareSummaries);
}
