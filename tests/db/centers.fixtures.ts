import { db } from "@/server/db";
import { PREFIX } from "./helpers";

// สร้างศูนย์ทดสอบ; withRequest = ใส่ใบเบิก 1 ใบ (ไว้ทดสอบห้ามลบศูนย์ที่เคยเบิก)
// ไม่สร้าง ApprovalLog เพราะลบไม่ได้ (append-only) — ใบเบิกทดสอบถูกลบใน cleanup()
export async function createCenterForTest(code: string, options: { withRequest?: boolean } = {}) {
  const center = await db.center.create({
    data: { customerCode: `${PREFIX}${code}`, name: `ศูนย์ ${code}`, normalAmount: "749.00", dueDay: 5 },
  });
  if (options.withRequest) {
    const creator = await db.user.findFirstOrThrow({ where: { username: { startsWith: PREFIX } } });
    await db.request.create({
      data: {
        centerId: center.id,
        invoiceNo: "INV-TEST",
        amount: "749.00",
        periodStart: new Date("2026-09-01"),
        periodEnd: new Date("2026-09-30"),
        dueDate: new Date("2026-10-15"),
        createdById: creator.id,
      },
    });
  }
  return center;
}
