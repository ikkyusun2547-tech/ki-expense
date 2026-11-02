import { Suspense, type ReactNode } from "react";
import { NAV_ITEMS } from "@/lib/auth/routes";
import { ROLE_LABEL } from "@/lib/status";
import { nameInitial, nameWithoutPrefix } from "@/lib/thai/name";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { TopNav } from "./TopNav";

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
  // ตำแหน่ง (บังคับเฉพาะผู้จัดทำ/ผู้อนุมัติ) — ไม่มี = แสดงบทบาทแทน
  const { title } = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { title: true } });

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopNav
        items={NAV_ITEMS[user.role]}
        user={{
          name: user.name,
          fullName: nameWithoutPrefix(user.name),
          title: title || ROLE_LABEL[user.role],
          roleLabel: ROLE_LABEL[user.role],
          initial: nameInitial(user.name),
        }}
      />
      {/* มือถือ: เว้นที่ด้านล่างให้แถบเมนูล่าง */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:pb-10 lg:px-8 lg:pt-8">{children}</main>
      <footer className="hidden py-5 text-center text-xs text-slate-400 md:block">บริษัท น้ำตาลสุรินทร์ จำกัด · ระบบภายใน</footer>
    </div>
  );
}

function FrameSkeleton() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="h-16 border-b border-slate-200/70 bg-white" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
      </main>
    </div>
  );
}
