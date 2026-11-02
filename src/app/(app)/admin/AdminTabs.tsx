import { Building, Smartphone, Users } from "lucide-react";
import { PillTabs } from "@/components/ui";

// เมนูย่อยของ "จัดการระบบ" (เมนูบนมีปุ่มเดียว) — ทะเบียนศูนย์ / ทะเบียนเบอร์โทร / ผู้ใช้
const TABS = [
  { href: "/admin/centers", label: "ทะเบียนศูนย์", icon: Building },
  { href: "/admin/phones", label: "ทะเบียนเบอร์โทร", icon: Smartphone },
  { href: "/admin/users", label: "ผู้ใช้", icon: Users },
];

export function AdminTabs({ current }: { current: string }) {
  return <PillTabs label="จัดการระบบ" tabs={TABS.map((t) => ({ ...t, active: t.href === current }))} />;
}
