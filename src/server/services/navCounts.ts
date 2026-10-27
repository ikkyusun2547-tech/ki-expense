import "server-only";
import { kindHref } from "@/lib/auth/routes";
import type { ISODate } from "@/lib/thai/date";
import type { CurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { getCenterSummaries } from "@/server/services/summary";

// ตัวเลขงานค้างบนเมนู (แทนการแจ้งเตือน — v1 ไม่มีอีเมล)
// tone: red = เลยกำหนด, amber = รอให้ตัวเองทำ, zinc = ดูไว้เฉย ๆ (admin)
export type NavCount = { count: number; tone: "red" | "amber" | "zinc" };
export type NavCounts = Record<string, NavCount>;

const pending = (approverId?: string) => db.request.count({ where: { status: "PENDING", deletedAt: null, ...(approverId && { approverId }) } });
const awaitingPayment = () => db.request.count({ where: { status: "APPROVED", deletedAt: null } });

export async function getNavCounts(user: CurrentUser, today: ISODate): Promise<NavCounts> {
  const counts: NavCounts = {};
  const put = (href: string, count: number, tone: NavCount["tone"]) => {
    if (count > 0) counts[href] = { count, tone };
  };

  switch (user.role) {
    case "CREATOR": {
      // แยกตามประเภท (เมนูค่าอินเทอร์เน็ต / ค่าโทรศัพท์): ศูนย์/เบอร์ที่ต้องเบิก (เลยกำหนด/ใกล้ครบ) + ใบของตัวเองที่ยังไม่ส่งขออนุมัติ (รวมใบที่ถูกตีกลับ)
      const summaries = await getCenterSummaries(today);
      for (const kind of ["INTERNET", "PHONE"] as const) {
        const mine = summaries.filter((s) => s.center.kind === kind);
        const overdue = mine.filter((s) => s.state === "OVERDUE").length;
        const dueSoon = mine.filter((s) => s.state === "DUE_SOON").length;
        put(kindHref("/summary", kind), overdue + dueSoon, overdue > 0 ? "red" : "amber");
        put(kindHref("/requests", kind), await db.request.count({ where: { status: "CREATED", deletedAt: null, createdById: user.id, center: { kind } } }), "amber");
      }
      break;
    }
    case "APPROVER":
      put("/approvals", await pending(user.id), "amber");
      break;
    case "ACCOUNTING":
      put("/accounting", await awaitingPayment(), "amber");
      break;
    case "ADMIN":
      put("/approvals", await pending(), "zinc");
      put("/accounting", await awaitingPayment(), "zinc");
      break;
  }
  return counts;
}
