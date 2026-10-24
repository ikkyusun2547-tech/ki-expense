"use client";

import { Building, Calculator, LayoutDashboard, Receipt, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconType } from "@/components/ui";
import type { NavItem } from "@/lib/auth/routes";

// ไอคอนผูกตาม href (routes.ts ใช้ใน proxy ด้วย จึงไม่ import ไลบรารีไอคอนที่นั่น)
const ICONS: Record<string, IconType> = {
  "/requests": Receipt,
  "/accounting": Calculator,
  "/summary": LayoutDashboard,
  "/admin/centers": Building,
  "/admin/users": Users,
  "/admin/settings": Settings,
};

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 text-sm">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = ICONS[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 font-medium text-emerald-800"
                : "flex items-center gap-1.5 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
