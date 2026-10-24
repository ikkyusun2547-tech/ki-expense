import { Suspense, type ReactNode } from "react";
import { NAV_ITEMS } from "@/lib/auth/routes";
import { ROLE_LABEL } from "@/lib/status";
import { nameInitial } from "@/lib/thai/name";
import { requireUser } from "@/server/auth";
import { Sidebar } from "./Sidebar";

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
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <Sidebar
        items={NAV_ITEMS[user.role]}
        user={{ name: user.name, roleLabel: ROLE_LABEL[user.role], initial: nameInitial(user.name) }}
      />
      <div className="flex flex-1 flex-col lg:pl-64">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">{children}</main>
        <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
          บริษัท น้ำตาลสุรินทร์ จำกัด · ระบบภายใน
        </footer>
      </div>
    </div>
  );
}

function FrameSkeleton() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <div className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block" />
      <div className="h-14 border-b border-slate-200 bg-white lg:hidden" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:pl-72">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      </main>
    </div>
  );
}
