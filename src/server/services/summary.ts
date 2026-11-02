import "server-only";
import type { RequestStatus, ServiceKind } from "@/generated/prisma/enums";
import { toISODate, type ISODate } from "@/lib/thai/date";
import { db } from "@/server/db";

// การ์ดศูนย์/เบอร์ (หน้าศูนย์ & เบอร์ และหน้าแรก) — เฉพาะที่ใช้งานอยู่ + ใบเบิกล่าสุดของแต่ละศูนย์
// ไม่ติดตามวันครบกำหนดแล้ว (ผู้ใช้ตัด 2026-10-31: "ใบแจ้งมาไม่ตรงกัน — ใบแจ้งมาแล้วผู้จัดทำค่อยทำใบเอง")
export type CenterCardRow = {
  center: {
    id: string;
    kind: ServiceKind;
    customerCode: string;
    serviceNumber: string | null;
    provider: string;
    name: string;
    normalAmount: string;
  };
  latest?: { id: string; status: RequestStatus; periodStart: ISODate; periodEnd: ISODate }; // ใบล่าสุด (ไม่นับใบที่ลบ)
};

// kind ไม่ส่ง = ทั้งศูนย์และเบอร์
export async function getCenterCards(kind?: ServiceKind): Promise<CenterCardRow[]> {
  const centers = await db.center.findMany({
    where: { status: "ACTIVE", ...(kind && { kind }) },
    orderBy: { customerCode: "asc" },
    include: {
      requests: {
        where: { deletedAt: null },
        orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { id: true, status: true, periodStart: true, periodEnd: true },
      },
    },
  });

  return centers.map(({ requests: [r], ...c }) => ({
    center: {
      id: c.id,
      kind: c.kind,
      customerCode: c.customerCode,
      serviceNumber: c.serviceNumber,
      provider: c.provider,
      name: c.name,
      normalAmount: c.normalAmount.toFixed(2),
    },
    ...(r && { latest: { id: r.id, status: r.status, periodStart: toISODate(r.periodStart), periodEnd: toISODate(r.periodEnd) } }),
  }));
}
