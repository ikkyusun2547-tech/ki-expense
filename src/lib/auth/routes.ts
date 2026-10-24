import type { Role } from "@/generated/prisma/enums";

// ค่าที่ใช้ร่วมกันระหว่าง proxy.ts กับโค้ดฝั่งเซิร์ฟเวอร์ (ห้าม import db ที่นี่)

export const SESSION_COOKIE = "ie_session";

export const PUBLIC_PATHS = ["/login"];

export const HOME_PATH: Record<Role, string> = {
  CREATOR: "/requests",
  ACCOUNTING: "/accounting",
  ADMIN: "/admin/centers",
};

export type NavItem = { href: string; label: string };

const SUMMARY: NavItem = { href: "/summary", label: "สรุปรายศูนย์" };

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  CREATOR: [{ href: "/requests", label: "ใบเบิก" }, SUMMARY],
  ACCOUNTING: [{ href: "/accounting", label: "ฝ่ายบัญชี" }, SUMMARY],
  ADMIN: [
    { href: "/requests", label: "ใบเบิก" },
    { href: "/accounting", label: "ฝ่ายบัญชี" },
    SUMMARY,
    { href: "/admin/centers", label: "ทะเบียนศูนย์" },
    { href: "/admin/users", label: "ผู้ใช้" },
    { href: "/admin/settings", label: "ตั้งค่า" },
  ],
};
