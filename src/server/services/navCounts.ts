import "server-only";
import type { CurrentUser } from "@/server/auth";
import { db } from "@/server/db";

// ตัวเลขงานค้างบนเมนู (แทนการแจ้งเตือน — v1 ไม่มีอีเมล)
// tone: amber = รอให้ตัวเองทำ, zinc = ดูไว้เฉย ๆ (admin)
export type NavCount = { count: number; tone: "amber" | "zinc" };
export type NavCounts = Record<string, NavCount>;

const pending = (approverId?: string) => db.request.count({ where: { status: "PENDING", deletedAt: null, ...(approverId && { approverId }) } });
// งานของฝ่ายบัญชี = รอรับเอกสาร + รอจ่าย
const accountingQueue = () => db.request.count({ where: { status: { in: ["APPROVED", "RECEIVED"] }, deletedAt: null } });

export async function getNavCounts(user: CurrentUser): Promise<NavCounts> {
  const counts: NavCounts = {};
  const put = (href: string, count: number, tone: NavCount["tone"]) => {
    if (count > 0) counts[href] = { count, tone };
  };

  switch (user.role) {
    case "CREATOR": {
      // ใบของตัวเองที่ยังไม่ส่งขออนุมัติ (รวมใบที่ถูกตีกลับ) — ไม่เตือนวันครบกำหนดของศูนย์แล้ว (ผู้ใช้ตัด 2026-10-31)
      put("/requests", await db.request.count({ where: { status: "CREATED", deletedAt: null, createdById: user.id } }), "amber");
      break;
    }
    case "APPROVER":
      put("/approvals", await pending(user.id), "amber");
      break;
    case "ACCOUNTING":
      put("/accounting", await accountingQueue(), "amber");
      break;
    case "ADMIN":
      put("/approvals", await pending(), "zinc");
      put("/accounting", await accountingQueue(), "zinc");
      break;
  }
  return counts;
}
