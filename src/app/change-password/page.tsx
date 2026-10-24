import { ArrowLeft, KeyRound } from "lucide-react";
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
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <KeyRound className="size-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">เปลี่ยนรหัสผ่าน</h1>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <Suspense fallback={<p className="text-sm text-slate-500">กำลังโหลด…</p>}>
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
    <div className="flex flex-col gap-5">
      {user.mustChangePassword ? (
        <Alert tone="info">สวัสดี {user.name} — กรุณาตั้งรหัสผ่านใหม่ของคุณเองก่อนเริ่มใช้งาน</Alert>
      ) : (
        <Link href={HOME_PATH[user.role]} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> กลับ
        </Link>
      )}
      <ChangePasswordForm />
    </div>
  );
}
