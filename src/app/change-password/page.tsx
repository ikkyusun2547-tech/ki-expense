import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui";
import { HOME_PATH } from "@/lib/auth/routes";
import { requireUser } from "@/server/auth";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata: Metadata = { title: "เปลี่ยนรหัสผ่าน · ระบบเบิกค่าอินเทอร์เน็ต" };

// อยู่นอกกลุ่ม (app) เพราะผู้ที่ถูกบังคับเปลี่ยนรหัสต้องเข้าหน้านี้ได้ก่อนเข้าหน้าอื่น
export default function ChangePasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-zinc-900">เปลี่ยนรหัสผ่าน</h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <Suspense fallback={<p className="text-sm text-zinc-500">กำลังโหลด…</p>}>
            <ChangePasswordContent />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function ChangePasswordContent() {
  const user = await requireUser({ allowMustChangePassword: true });

  return (
    <div className="flex flex-col gap-4">
      {user.mustChangePassword ? (
        <Alert tone="info">
          สวัสดี {user.name} — กรุณาตั้งรหัสผ่านใหม่ของคุณเองก่อนเริ่มใช้งาน
        </Alert>
      ) : (
        <Link href={HOME_PATH[user.role]} className="text-sm text-emerald-700 hover:underline">
          ← กลับ
        </Link>
      )}
      <ChangePasswordForm />
    </div>
  );
}
