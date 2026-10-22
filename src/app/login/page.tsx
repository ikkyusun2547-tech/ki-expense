import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "เข้าสู่ระบบ · ระบบเบิกค่าอินเทอร์เน็ต" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">ระบบเบิกค่าอินเทอร์เน็ต</h1>
          <p className="mt-1 text-sm text-zinc-600">บริษัท น้ำตาลสุรินทร์ จำกัด · ฝ่ายจัดหาวัตถุดิบ</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-zinc-500">ลืมรหัสผ่าน ติดต่อผู้ดูแลระบบเพื่อรีเซ็ต</p>
      </div>
    </main>
  );
}
