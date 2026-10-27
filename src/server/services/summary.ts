import "server-only";
import type { ServiceKind } from "@/generated/prisma/enums";
import { compareSummaries, summarizeCenter, type CenterSummaryResult } from "@/lib/rules/centerSummary";
import { fromISODate, toISODate, type ISODate } from "@/lib/thai/date";
import { db } from "@/server/db";

export type CenterSummaryRow = CenterSummaryResult & {
  center: { id: string; kind: ServiceKind; customerCode: string; name: string; dueDay: number };
};

// ตารางสรุปรายศูนย์/รายเบอร์ — เฉพาะที่ใช้งานอยู่ (ย้าย/ปิด/ยกเลิก เบิกไม่ได้ จึงไม่ต้องติดตาม)
// kind ไม่ส่ง = ทั้งศูนย์และเบอร์; ใช้ใบเบิกที่วันครบกำหนดตั้งแต่เดือนนี้ขึ้นไป (ใบของรอบที่ใหม่กว่านับว่าเดือนนี้เบิกแล้ว)
export async function getCenterSummaries(today: ISODate, kind?: ServiceKind): Promise<CenterSummaryRow[]> {
  const [y, m] = today.split("-").map(Number);
  const from = fromISODate(`${y}-${String(m).padStart(2, "0")}-01`);

  const centers = await db.center.findMany({
    where: { status: "ACTIVE", ...(kind && { kind }) },
    orderBy: { customerCode: "asc" },
    include: {
      requests: {
        where: { deletedAt: null, dueDate: { gte: from } },
        select: { id: true, dueDate: true, status: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return centers
    .map((c) => ({
      center: { id: c.id, kind: c.kind, customerCode: c.customerCode, name: c.name, dueDay: c.dueDay },
      ...summarizeCenter(
        c.dueDay,
        c.requests.map((r) => ({ id: r.id, dueDate: toISODate(r.dueDate), status: r.status })),
        today,
      ),
    }))
    .sort(compareSummaries);
}
