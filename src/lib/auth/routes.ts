import type { Role, ServiceKind } from "@/generated/prisma/enums";

// ค่าที่ใช้ร่วมกันระหว่าง proxy.ts กับโค้ดฝั่งเซิร์ฟเวอร์ (ห้าม import db ที่นี่)

export const SESSION_COOKIE = "ie_session";

export const PUBLIC_PATHS = ["/login"];

export const HOME_PATH: Record<Role, string> = {
  CREATOR: "/home", // หน้าแรกแบบแอป: ปุ่มใหญ่เบิกค่าอินเทอร์เน็ต/โทรศัพท์ + ใบเบิกของฉันอยู่ที่ไหน
  ACCOUNTING: "/accounting",
  APPROVER: "/approvals",
  ADMIN: "/home",
};

// เมนูแบบแอป (ผู้ใช้เลือก 2026-10-31 แทนแถบเมนูซ้าย): จอใหญ่ = แท็บด้านบน, มือถือ = แถบล่าง (short = ชื่อสั้นบนแถบล่าง)
// ค่าอินเทอร์เน็ต/โทรศัพท์ไม่แยกเมนูแล้ว — เลือกด้วยแท็บในหน้า (?kind=)
// match = path ที่นับว่าอยู่ในเมนูนี้ (ไม่ระบุ = href); ตัวเลขงานค้างบนเมนูใช้ href เป็น key
export type NavItem = { href: string; label: string; short: string; match?: string };

// หน้าสรุป/รายการใบเบิกของแต่ละประเภท = หน้าเดียวกันที่กรองด้วย ?kind=
export const kindHref = (path: "/summary" | "/requests", kind: ServiceKind) => `${path}?kind=${kind}`;

const HOME: NavItem = { href: "/home", label: "หน้าแรก", short: "หน้าแรก" };
const CENTERS: NavItem = { href: "/summary", label: "ศูนย์ & เบอร์", short: "ศูนย์" };
const REQUESTS: NavItem = { href: "/requests", label: "ใบเบิก", short: "ใบเบิก" };
const APPROVALS: NavItem = { href: "/approvals", label: "รออนุมัติ", short: "อนุมัติ" };
const ACCOUNTING: NavItem = { href: "/accounting", label: "ฝ่ายบัญชี", short: "บัญชี" };
const HISTORY: NavItem = { href: "/history", label: "ประวัติ", short: "ประวัติ" }; // ย้อนดูรายเดือน — ทุกบทบาท (ผู้ใช้เลือก 2026-10-31)
const ADMIN: NavItem = { href: "/admin/centers", label: "จัดการระบบ", short: "จัดการ", match: "/admin" };

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  CREATOR: [HOME, CENTERS, REQUESTS, HISTORY],
  APPROVER: [APPROVALS, CENTERS, HISTORY],
  ACCOUNTING: [ACCOUNTING, CENTERS, HISTORY],
  ADMIN: [HOME, REQUESTS, APPROVALS, ACCOUNTING, CENTERS, HISTORY, ADMIN],
};
