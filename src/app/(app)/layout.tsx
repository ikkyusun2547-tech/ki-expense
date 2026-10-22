import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NAV_ITEMS } from "@/lib/auth/routes";
import { ROLE_LABEL } from "@/lib/status";
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

async function AppFrame({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-bold text-emerald-800">
            ระบบเบิกค่าอินเทอร์เน็ต
          </Link>
          <NavLinks items={NAV_ITEMS[user.role]} />
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-zinc-700">
              {user.name} <span className="text-zinc-400">· {ROLE_LABEL[user.role]}</span>
            </span>
            <Link href="/change-password" className="text-zinc-600 hover:text-zinc-900">
              เปลี่ยนรหัสผ่าน
            </Link>
            <form action={logout}>
              <button type="submit" className="text-zinc-600 hover:text-zinc-900">
                ออกจากระบบ
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

function FrameSkeleton() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <header className="h-[53px] border-b border-zinc-200 bg-white" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 text-sm text-zinc-500">กำลังโหลด…</main>
    </div>
  );
}
