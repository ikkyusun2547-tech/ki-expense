import type { Role } from "@/generated/prisma/enums";

// ค่าที่ใช้ร่วมกันระหว่าง proxy.ts กับโค้ดฝั่งเซิร์ฟเวอร์ (ห้าม import db ที่นี่)

export const SESSION_COOKIE = "ie_session";

export const PUBLIC_PATHS = ["/login"];

export const HOME_PATH: Record<Role, string> = {
  CREATOR: "/summary", // ผู้จัดทำเริ่มจากงานที่ต้องทำ: ศูนย์ที่ยังไม่เบิก
  ACCOUNTING: "/accounting",
  APPROVER: "/approvals",
  ADMIN: "/admin/centers",
};

// group "admin" = เมนูจัดการระบบ แสดงแยกกลุ่มท้ายแถบเมนู
export type NavItem = { href: string; label: string; group?: "admin" };

const SUMMARY: NavItem = { href: "/summary", label: "สรุปรายศูนย์" };
const APPROVALS: NavItem = { href: "/approvals", label: "รออนุมัติ" };

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  CREATOR: [SUMMARY, { href: "/requests", label: "ใบเบิก" }],
  ACCOUNTING: [{ href: "/accounting", label: "ฝ่ายบัญชี" }, SUMMARY],
  APPROVER: [APPROVALS, SUMMARY],
  ADMIN: [
    { href: "/requests", label: "ใบเบิก" },
    APPROVALS,
    { href: "/accounting", label: "ฝ่ายบัญชี" },
    SUMMARY,
    { href: "/admin/centers", label: "ทะเบียนศูนย์", group: "admin" },
    { href: "/admin/phones", label: "ทะเบียนเบอร์โทร", group: "admin" },
    { href: "/admin/users", label: "ผู้ใช้", group: "admin" },
  ],
};
