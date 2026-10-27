"use client";

import { Building, Calculator, KeyRound, LayoutDashboard, LogOut, Menu, Receipt, Settings, Smartphone, Stamp, Users, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cx, type IconType } from "@/components/ui";
import type { NavItem } from "@/lib/auth/routes";
import { logout } from "@/server/actions/auth";
import type { NavCount, NavCounts } from "@/server/services/navCounts";

// แถบเมนูด้านซ้าย: จอใหญ่แสดงตลอด, จอเล็กพับเก็บ เปิดด้วยปุ่ม ☰
// ไอคอนผูกตาม path ของ href (routes.ts ใช้ใน proxy ด้วย จึงไม่ import ไลบรารีไอคอนที่นั่น)
const ICONS: Record<string, IconType> = {
  "/requests": Receipt,
  "/approvals": Stamp,
  "/accounting": Calculator,
  "/summary": LayoutDashboard,
  "/admin/centers": Building,
  "/admin/phones": Smartphone,
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

// เมนูที่มี ?kind= (แยกค่าอินเทอร์เน็ต/โทรศัพท์) ไฮไลต์เมื่อ path และประเภทตรงกัน
// /summary ไม่มี kind = ค่าอินเทอร์เน็ต (หน้าแรกของผู้จัดทำ); หน้าใบเบิกรายใบไม่รู้ประเภทฝั่งเบราว์เซอร์ จึงไม่ไฮไลต์
function isActive(href: string, pathname: string, pageKind: string | null): boolean {
  const [path, query] = href.split("?");
  const kind = new URLSearchParams(query).get("kind");
  if (!kind) return pathname === path || pathname.startsWith(`${path}/`);
  return pathname === path && (pageKind ?? (path === "/summary" ? "INTERNET" : null)) === kind;
}

// ธีม "กรมท่า + แดง KI" (globals.css): แถบเมนูพื้นกรมท่าเข้ม ตัวหนังสือขาว ทุกกลุ่มโทนเดียว (เลิกสีแยกกลุ่ม — ดูสะเปะสะปะ)
// เมนูที่เปิดอยู่ = พื้นขาวโปร่ง + แถบแดง KI ด้านซ้าย
const GROUPS: { key: NavItem["group"]; title: string }[] = [
  { key: undefined, title: "งานประจำ" },
  { key: "INTERNET", title: "ค่าอินเทอร์เน็ต" },
  { key: "PHONE", title: "ค่าโทรศัพท์" },
  { key: "admin", title: "จัดการระบบ" },
];

export function Sidebar({ items, user }: { items: NavItem[]; user: SidebarUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const counts = useNavCounts();
  const hasWork = Object.keys(counts).length > 0;

  return (
    <>
      {/* จอใหญ่ */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-900 text-white lg:flex">
        <SidebarContent items={items} user={user} pathname={pathname} counts={counts} />
      </aside>

      {/* จอเล็ก: แถบบน + ลิ้นชักเมนู */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-brand-900 px-4 text-white lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative -ml-1 flex size-9 items-center justify-center rounded-lg text-brand-100 hover:bg-white/10"
          aria-label="เปิดเมนู"
        >
          <Menu className="size-5" aria-hidden />
          {/* มีงานค้าง → จุดแดงบนปุ่มเมนู (จอเล็กไม่เห็นตัวเลขจนกว่าจะเปิดเมนู) */}
          {hasWork && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent-500 ring-2 ring-brand-900" aria-hidden />}
        </button>
        <Brand compact />
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="เมนู">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-brand-900 text-white shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3.5 flex size-9 items-center justify-center rounded-lg text-brand-200 hover:bg-white/10 hover:text-white"
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

// ชื่อระบบ: แถบเมนู = [โลโก้ KI | ชื่อระบบตัวหนา + บรรทัดรองบอกว่าเบิกอะไร] แถวเดียว (ผู้ใช้ตั้งชื่อสั้น "ระบบเบิกค่าบริการ" 2026-10-26)
// compact = แถบบนจอเล็ก (สูงจำกัด) โลโก้ + ชื่อระบบ
// โลโก้ public/logo-ki-mark.png = ส่วนเครื่องหมาย KI (กรอบพระอาทิตย์ + KI) จาก logo_ki.png ที่ผู้ใช้ตัดพื้นหลัง (2026-10-27)
// ด้านในกรอบเติมขาวกลับแล้ว รอบนอกโปร่งใส — วางบนพื้นกรมท่าได้ตรง ๆ ไม่ต้องมีแผ่นขาวรอง
function Brand({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  if (compact) {
    return (
      <Link href="/" onClick={onNavigate} className="flex min-w-0 items-center gap-3">
        <Image src="/logo-ki-mark.png" alt="KI" width={258} height={128} className="h-7 w-auto shrink-0" priority />
        <span className="truncate text-sm font-bold">ระบบเบิกค่าบริการ</span>
      </Link>
    );
  }
  return (
    <Link href="/" onClick={onNavigate} className="flex min-w-0 items-center gap-3">
      <Image src="/logo-ki-mark.png" alt="KI บริษัท น้ำตาลสุรินทร์ จำกัด" width={258} height={128} className="h-9 w-auto shrink-0" priority />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[15px] font-bold text-white">ระบบเบิกค่าบริการ</span>
        <span className="mt-0.5 block truncate text-xs text-brand-200">อินเทอร์เน็ต · โทรศัพท์</span>
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
  const pageKind = useSearchParams().get("kind");

  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-4">
        <Brand onNavigate={onNavigate} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]" aria-label="เมนูหลัก">
        {GROUPS.map((g) => {
          const groupItems = items.filter((i) => i.group === g.key);
          return (
            groupItems.length > 0 && (
              <NavGroup
                key={g.title}
                title={g.title}
                items={groupItems}
                pathname={pathname}
                pageKind={pageKind}
                counts={counts}
                onNavigate={onNavigate}
              />
            )
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <UserMenu user={user} onNavigate={onNavigate} />
      </div>
    </>
  );
}

// การ์ดผู้ใช้ท้ายแถบเมนู: กดแล้วเมนูเด้งขึ้น (เปลี่ยนรหัสผ่าน / ออกจากระบบ) — ปกติซ่อนไว้ให้แถบเมนูโล่ง
// ปิดเมื่อกดนอกเมนู / กด Esc / เลือกรายการ
function UserMenu({ user, onNavigate }: { user: SidebarUser; onNavigate?: () => void }) {
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

  const item = "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-700";

  return (
    <div ref={ref} className="relative">
      {open && (
        <div role="menu" className="absolute inset-x-0 bottom-full mb-2 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <Link
            href="/change-password"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className={cx(item, "hover:bg-slate-100 hover:text-slate-900")}
          >
            <KeyRound className="size-4 text-slate-400" aria-hidden /> เปลี่ยนรหัสผ่าน
          </Link>
          <form action={logout}>
            <button type="submit" role="menuitem" className={cx(item, "hover:bg-red-50 hover:text-red-700")}>
              <LogOut className="size-4 text-slate-400" aria-hidden /> ออกจากระบบ
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="บัญชีของฉัน — เปลี่ยนรหัสผ่าน / ออกจากระบบ"
        // หน้าตาเป็นปุ่มชัด ๆ (กรอบ + เงา + ไอคอนเฟือง) — ผู้ใช้บอกว่าแบบเดิมไม่รู้ว่ากดได้
        className={cx(
          "group flex w-full items-center gap-3 rounded-lg border px-2 py-2 text-left transition-colors",
          open ? "border-white/25 bg-white/15" : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10",
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-sm font-semibold text-white" aria-hidden>
          {user.initial}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium text-white">{user.name}</span>
          {user.roleLabel !== user.name && <span className="block truncate text-xs text-brand-200">{user.roleLabel}</span>}
        </span>
        <span
          className={cx(
            "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors",
            open ? "bg-white/20 text-white" : "bg-white/10 text-brand-100 group-hover:bg-white/20 group-hover:text-white",
          )}
          aria-hidden
        >
          <Settings className="size-4" />
        </span>
      </button>
    </div>
  );
}

function NavGroup({
  title,
  items,
  pathname,
  pageKind,
  counts,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  pageKind: string | null;
  counts: NavCounts;
  onNavigate?: () => void;
}) {
  return (
    <div className="border-t border-white/10 py-2.5 first:border-t-0 first:pt-1 last:pb-1">
      <div className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-brand-300">{title}</div>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = isActive(item.href, pathname, pageKind);
          const Icon = ICONS[item.href.split("?")[0]];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                  active ? "bg-white/15 font-semibold text-white" : "text-brand-100 hover:bg-white/5 hover:text-white",
                )}
              >
                {active && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-accent-500" aria-hidden />}
                {Icon && <Icon className={cx("size-[18px] shrink-0", active ? "text-white" : "text-brand-300")} aria-hidden />}
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
  zinc: "bg-white/15 text-white",
};

function CountBadge({ count }: { count: NavCount }) {
  return (
    <span className={cx("ml-auto min-w-6 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums leading-5", COUNT_TONE[count.tone])}>
      {count.count > 99 ? "99+" : count.count}
    </span>
  );
}
