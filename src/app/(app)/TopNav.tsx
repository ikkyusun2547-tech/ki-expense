"use client";

import { Building, Calculator, CalendarDays, ChevronDown, Home, KeyRound, LogOut, Receipt, Settings, Stamp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cx, type IconType } from "@/components/ui";
import type { NavItem } from "@/lib/auth/routes";
import { logout } from "@/server/actions/auth";
import type { NavCount, NavCounts } from "@/server/services/navCounts";

// เมนูแบบแอป (ผู้ใช้เลือก 2026-10-31 — แถบเมนูซ้ายเดิม "ทางการไป"):
// จอใหญ่ = แถบบน [โลโก้ | แท็บเมนู | ผู้ใช้] · มือถือ = แถบบน [โลโก้ | ผู้ใช้] + แถบเมนูล่างแบบแอป
// ไอคอนผูกตาม href (routes.ts ใช้ใน proxy ด้วย จึงไม่ import ไลบรารีไอคอนที่นั่น)
const ICONS: Record<string, IconType> = {
  "/home": Home,
  "/summary": Building,
  "/requests": Receipt,
  "/approvals": Stamp,
  "/accounting": Calculator,
  "/history": CalendarDays,
  "/admin/centers": Settings,
};

// fullName = ชื่อ-นามสกุลไม่มีคำนำหน้า · title = ตำแหน่ง (ไม่มี = บทบาท)
export type NavUser = { name: string; fullName: string; title: string; roleLabel: string; initial: string };

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

function isActive(item: NavItem, pathname: string): boolean {
  const base = item.match ?? item.href;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function TopNav({ items, user }: { items: NavItem[]; user: NavUser }) {
  const pathname = usePathname();
  const counts = useNavCounts();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 lg:px-8">
          <Brand compact={items.length > 4} />
          {/* จอใหญ่: แท็บเมนู (admin มี 6 ปุ่ม — จอกลางเลื่อนแนวนอนได้) */}
          <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] md:flex" aria-label="เมนูหลัก">
            {items.map((item) => {
              const active = isActive(item, pathname);
              const Icon = ICONS[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                    active ? "bg-brand-700 text-white shadow-md shadow-brand-700/20" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  {Icon && <Icon className="size-4" aria-hidden />}
                  {item.label}
                  {counts[item.href] && <CountBadge count={counts[item.href]} onDark={active} />}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto md:ml-0">
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      {/* มือถือ: แถบเมนูล่าง (ปุ่มใหญ่ กดง่ายด้วยนิ้วโป้ง) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="เมนูหลัก"
      >
        <ul className="flex">
          {items.map((item) => {
            const active = isActive(item, pathname);
            const Icon = ICONS[item.href];
            const count = counts[item.href];
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-brand-700" : "text-slate-500")}
                >
                  <span
                    className={cx(
                      "relative flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                      active && "bg-brand-100",
                    )}
                  >
                    {Icon && <Icon className="size-5" aria-hidden />}
                    {count && (
                      <span
                        className={cx(
                          "absolute -right-0.5 -top-1 min-w-4 rounded-full px-1 text-center text-[10px] font-bold leading-4 ring-2 ring-white",
                          COUNT_TONE[count.tone],
                        )}
                      >
                        {count.count > 99 ? "99+" : count.count}
                      </span>
                    )}
                  </span>
                  {item.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

// โลโก้ public/logo-ki-mark.png = ส่วนเครื่องหมาย KI (กรอบพระอาทิตย์ + KI) จาก logo_ki.png ที่ผู้ใช้ตัดพื้นหลัง (2026-10-27)
// compact = เมนูเยอะ (admin) → ชื่อระบบแสดงเฉพาะจอกว้างมาก ให้แท็บมีที่พอ
function Brand({ compact }: { compact: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      <Image src="/logo-ki-mark.png" alt="KI บริษัท น้ำตาลสุรินทร์ จำกัด" width={258} height={128} className="h-8 w-auto" priority />
      <span className={cx("hidden leading-tight", compact ? "xl:block" : "sm:block")}>
        <span className="block text-sm font-bold text-brand-900">ระบบเบิกค่าบริการ</span>
        <span className="block text-[11px] text-slate-500">อินเทอร์เน็ต · โทรศัพท์</span>
      </span>
    </Link>
  );
}

// ปุ่มผู้ใช้มุมขวาบน: กดแล้วเมนูเลื่อนลง (เปลี่ยนรหัสผ่าน / ออกจากระบบ) — ปิดเมื่อกดนอกเมนู / Esc / เลือกรายการ
function UserMenu({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="บัญชีของฉัน — เปลี่ยนรหัสผ่าน / ออกจากระบบ"
        className={cx(
          "flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 transition-colors",
          open ? "border-brand-200 bg-brand-50" : "border-slate-200/70 bg-white hover:border-brand-200 hover:bg-brand-50",
        )}
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-sm font-semibold text-white"
          aria-hidden
        >
          {user.initial}
        </span>
        {/* ชื่อ-นามสกุล + ตำแหน่ง (ผู้ใช้ขอ 2026-10-31) */}
        <span className="min-w-0 text-left leading-tight">
          <span className="block max-w-36 truncate text-sm font-semibold text-slate-800 sm:max-w-48">{user.fullName}</span>
          <span className="block max-w-36 truncate text-xs text-slate-500 sm:max-w-48">{user.title}</span>
        </span>
        <ChevronDown className={cx("size-4 text-slate-400 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-60 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-xl">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold text-slate-900">{user.name}</div>
            <div className="text-xs text-slate-500">{user.title}</div>
            {user.title !== user.roleLabel && <div className="text-xs text-slate-400">บทบาท: {user.roleLabel}</div>}
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <Link href="/change-password" role="menuitem" onClick={() => setOpen(false)} className={cx(item, "hover:bg-slate-100 hover:text-slate-900")}>
            <KeyRound className="size-4 text-slate-400" aria-hidden /> เปลี่ยนรหัสผ่าน
          </Link>
          <form action={logout}>
            <button type="submit" role="menuitem" className={cx(item, "hover:bg-red-50 hover:text-red-700")}>
              <LogOut className="size-4 text-slate-400" aria-hidden /> ออกจากระบบ
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const COUNT_TONE: Record<NavCount["tone"], string> = {
  amber: "bg-amber-400 text-amber-950",
  zinc: "bg-slate-200 text-slate-700",
};

function CountBadge({ count, onDark }: { count: NavCount; onDark: boolean }) {
  return (
    <span
      className={cx(
        "min-w-5 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums leading-5",
        onDark && count.tone === "zinc" ? "bg-white/25 text-white" : COUNT_TONE[count.tone],
      )}
    >
      {count.count > 99 ? "99+" : count.count}
    </span>
  );
}
