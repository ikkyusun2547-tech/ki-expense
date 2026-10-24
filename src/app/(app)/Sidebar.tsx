"use client";

import { Building, Calculator, KeyRound, LayoutDashboard, LogOut, Menu, Receipt, Stamp, Users, Wifi, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cx, type IconType } from "@/components/ui";
import type { NavItem } from "@/lib/auth/routes";
import { logout } from "@/server/actions/auth";
import type { NavCount, NavCounts } from "@/server/services/navCounts";

// แถบเมนูด้านซ้าย: จอใหญ่แสดงตลอด, จอเล็กพับเก็บ เปิดด้วยปุ่ม ☰
// ไอคอนผูกตาม href (routes.ts ใช้ใน proxy ด้วย จึงไม่ import ไลบรารีไอคอนที่นั่น)
const ICONS: Record<string, IconType> = {
  "/requests": Receipt,
  "/approvals": Stamp,
  "/accounting": Calculator,
  "/summary": LayoutDashboard,
  "/admin/centers": Building,
  "/admin/users": Users,
};

export type SidebarUser = { name: string; roleLabel: string; initial: string };

const REFRESH_MS = 60_000;

// ตัวเลขงานค้าง: ดึงใหม่ทุกครั้งที่เปลี่ยนหน้า (รวม ?done=... หลังกดอนุมัติ/บันทึก), กลับมาที่หน้าต่าง และทุก 1 นาที
// ดึงไม่สำเร็จ (เช่น session หมดอายุ) → ไม่แสดงตัวเลข ไม่ต้องแจ้ง error
function useNavCounts(): NavCounts {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [counts, setCounts] = useState<NavCounts>({});

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/nav-counts", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : {}))
        .then((data: NavCounts) => !cancelled && setCounts(data))
        .catch(() => {});
    load();
    const timer = setInterval(load, REFRESH_MS);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [pathname, search]);

  return counts;
}

export function Sidebar({ items, user }: { items: NavItem[]; user: SidebarUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const counts = useNavCounts();
  const hasWork = Object.keys(counts).length > 0;

  return (
    <>
      {/* จอใหญ่ */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <SidebarContent items={items} user={user} pathname={pathname} counts={counts} />
      </aside>

      {/* จอเล็ก: แถบบน + ลิ้นชักเมนู */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative -ml-1 flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="เปิดเมนู"
        >
          <Menu className="size-5" aria-hidden />
          {/* มีงานค้าง → จุดแดงบนปุ่มเมนู (จอเล็กไม่เห็นตัวเลขจนกว่าจะเปิดเมนู) */}
          {hasWork && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red-500" aria-hidden />}
        </button>
        <Brand />
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="เมนู">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="ปิดเมนู"
            >
              <X className="size-5" aria-hidden />
            </button>
            {/* กดลิงก์ใดก็ได้ในลิ้นชัก → ปิดลิ้นชัก */}
            <SidebarContent items={items} user={user} pathname={pathname} counts={counts} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/" onClick={onNavigate} className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-sm">
        <Wifi className="size-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold text-slate-900">ระบบเบิกค่าอินเทอร์เน็ต</span>
        <span className="block text-xs text-slate-500">บริษัท น้ำตาลสุรินทร์ จำกัด</span>
      </span>
    </Link>
  );
}

function SidebarContent({
  items,
  user,
  pathname,
  counts,
  onNavigate,
}: {
  items: NavItem[];
  user: SidebarUser;
  pathname: string;
  counts: NavCounts;
  onNavigate?: () => void;
}) {
  const main = items.filter((i) => !i.group);
  const admin = items.filter((i) => i.group === "admin");

  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-slate-100 px-5">
        <Brand onNavigate={onNavigate} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="เมนูหลัก">
        <NavGroup title="งานประจำ" items={main} pathname={pathname} counts={counts} onNavigate={onNavigate} />
        {admin.length > 0 && <NavGroup title="จัดการระบบ" items={admin} pathname={pathname} counts={counts} onNavigate={onNavigate} />}
      </nav>

      <div className="shrink-0 border-t border-slate-100 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800" aria-hidden>
            {user.initial}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium text-slate-900">{user.name}</div>
            {user.roleLabel !== user.name && <div className="truncate text-xs text-slate-500">{user.roleLabel}</div>}
          </div>
        </div>
        <Link
          href="/change-password"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <KeyRound className="size-4" aria-hidden /> เปลี่ยนรหัสผ่าน
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="size-4" aria-hidden /> ออกจากระบบ
          </button>
        </form>
      </div>
    </>
  );
}

function NavGroup({
  title,
  items,
  pathname,
  counts,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  counts: NavCounts;
  onNavigate?: () => void;
}) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-2 px-3 text-xs font-semibold text-slate-400">{title}</div>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = ICONS[item.href];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40",
                  active ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-emerald-600" aria-hidden />}
                {Icon && <Icon className={cx("size-[18px]", active ? "text-emerald-700" : "text-slate-400")} aria-hidden />}
                {item.label}
                {counts[item.href] && <CountBadge count={counts[item.href]} />}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const COUNT_TONE: Record<NavCount["tone"], string> = {
  red: "bg-red-500 text-white",
  amber: "bg-amber-400 text-amber-950",
  zinc: "bg-slate-200 text-slate-700",
};

function CountBadge({ count }: { count: NavCount }) {
  return (
    <span className={cx("ml-auto min-w-6 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums leading-5", COUNT_TONE[count.tone])}>
      {count.count > 99 ? "99+" : count.count}
    </span>
  );
}
