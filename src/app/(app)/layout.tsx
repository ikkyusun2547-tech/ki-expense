import { KeyRound, LogOut, Wifi } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NAV_ITEMS } from "@/lib/auth/routes";
import { ROLE_LABEL } from "@/lib/status";
import { nameInitial } from "@/lib/thai/name";
import { logout } from "@/server/actions/auth";
import { requireUser } from "@/server/auth";
import { NavLinks } from "./NavLinks";

// กรอบของทุกหน้าหลังล็อกอิน — อ่าน session ภายใน Suspense ตามข้อกำหนดของ Cache Components
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<FrameSkeleton />}>
      <AppFrame>{children}</AppFrame>
    </Suspense>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-sm">
        <Wifi className="size-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold text-slate-900">ระบบเบิกค่าอินเทอร์เน็ต</span>
        <span className="block text-xs text-slate-500">น้ำตาลสุรินทร์ · ฝ่ายจัดหาวัตถุดิบ</span>
      </span>
    </Link>
  );
}

async function AppFrame({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const initial = nameInitial(user.name);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <Brand />
          <NavLinks items={NAV_ITEMS[user.role]} />
          <div className="ml-auto flex items-center gap-1">
            <div className="mr-2 flex items-center gap-2.5" title={`${user.name} · ${ROLE_LABEL[user.role]}`}>
              <span
                className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800"
                aria-hidden
              >
                {initial}
              </span>
              <span className="hidden leading-tight xl:block">
                <span className="block text-sm font-medium text-slate-900">{user.name}</span>
                <span className="block text-xs text-slate-500">{ROLE_LABEL[user.role]}</span>
              </span>
            </div>
            <Link
              href="/change-password"
              title="เปลี่ยนรหัสผ่าน"
              className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <KeyRound className="size-4" aria-hidden />
              <span className="sr-only">เปลี่ยนรหัสผ่าน</span>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                title="ออกจากระบบ"
                className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="size-4" aria-hidden />
                <span className="hidden xl:inline">ออกจากระบบ</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        บริษัท น้ำตาลสุรินทร์ จำกัด · ระบบภายใน
      </footer>
    </div>
  );
}

function FrameSkeleton() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <header className="h-[57px] border-b border-slate-200 bg-white" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      </main>
    </div>
  );
}
