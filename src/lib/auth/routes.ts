import type { Role, ServiceKind } from "@/generated/prisma/enums";

// ค่าที่ใช้ร่วมกันระหว่าง proxy.ts กับโค้ดฝั่งเซิร์ฟเวอร์ (ห้าม import db ที่นี่)

export const SESSION_COOKIE = "ie_session";

export const PUBLIC_PATHS = ["/login"];

export const HOME_PATH: Record<Role, string> = {
  CREATOR: "/summary", // ผู้จัดทำเริ่มจากงานที่ต้องทำ: ศูนย์ที่ยังไม่เบิก
  ACCOUNTING: "/accounting",
  APPROVER: "/approvals",
  ADMIN: "/admin/centers",
};

// กลุ่มในแถบเมนู: ไม่มี = งานประจำ, INTERNET / PHONE = แยกตามประเภทค่าใช้จ่าย (ผู้ใช้เลือก 2026-10-26), admin = จัดการระบบ
export type NavItem = { href: string; label: string; group?: ServiceKind | "admin" };

// หน้าสรุป/รายการใบเบิกของแต่ละประเภท = หน้าเดียวกันที่กรองด้วย ?kind= (ตัวเลขบนเมนูก็ใช้ href นี้เป็น key)
export const kindHref = (path: "/summary" | "/requests", kind: ServiceKind) => `${path}?kind=${kind}`;

const KIND_ITEMS = (withRequests: boolean): NavItem[] => [
  { href: kindHref("/summary", "INTERNET"), label: "สรุปรายศูนย์", group: "INTERNET" },
  ...(withRequests ? [{ href: kindHref("/requests", "INTERNET"), label: "ใบเบิก", group: "INTERNET" as const }] : []),
  { href: kindHref("/summary", "PHONE"), label: "สรุปรายเบอร์", group: "PHONE" },
  ...(withRequests ? [{ href: kindHref("/requests", "PHONE"), label: "ใบเบิก", group: "PHONE" as const }] : []),
];
const APPROVALS: NavItem = { href: "/approvals", label: "รออนุมัติ" };

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  CREATOR: KIND_ITEMS(true),
  ACCOUNTING: [{ href: "/accounting", label: "ฝ่ายบัญชี" }, ...KIND_ITEMS(false)],
  APPROVER: [APPROVALS, ...KIND_ITEMS(false)],
  ADMIN: [
    APPROVALS,
    { href: "/accounting", label: "ฝ่ายบัญชี" },
    ...KIND_ITEMS(true),
    { href: "/admin/centers", label: "ทะเบียนศูนย์", group: "admin" },
    { href: "/admin/phones", label: "ทะเบียนเบอร์โทร", group: "admin" },
    { href: "/admin/users", label: "ผู้ใช้", group: "admin" },
  ],
};
