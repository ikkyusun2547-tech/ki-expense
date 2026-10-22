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

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  CREATOR: [{ href: "/requests", label: "ใบเบิก" }],
  ACCOUNTING: [{ href: "/accounting", label: "ฝ่ายบัญชี" }],
  ADMIN: [
    { href: "/requests", label: "ใบเบิก" },
    { href: "/accounting", label: "ฝ่ายบัญชี" },
    { href: "/admin/centers", label: "ทะเบียนศูนย์" },
    { href: "/admin/users", label: "ผู้ใช้" },
  ],
};
