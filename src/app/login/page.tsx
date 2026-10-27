import { CalendarClock, FileText, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "เข้าสู่ระบบ · ระบบเบิกค่าบริการ" };

const FEATURES = [
  { icon: FileText, text: "สร้างใบเบิกจากรหัสลูกค้าหรือเบอร์โทร พิมพ์บันทึกภายในได้ทันที" },
  { icon: CalendarClock, text: "ติดตามศูนย์และเบอร์ที่ใกล้ครบกำหนดแต่ยังไม่เบิก" },
  { icon: ShieldCheck, text: "กันเบิกซ้ำ และเก็บประวัติทุกขั้นตอน" },
];

export default function LoginPage() {
  return (
    <main className="grid min-h-full flex-1 lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-white/5" aria-hidden />
        <div className="absolute -bottom-32 -left-16 size-80 rounded-full bg-white/5" aria-hidden />
        <div className="relative flex items-center gap-3">
          <Image src="/logo-ki-mark.png" alt="KI" width={258} height={128} className="h-11 w-auto" priority />
          <div className="font-semibold leading-tight">บริษัท น้ำตาลสุรินทร์ จำกัด</div>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight">ระบบเบิกค่าบริการ</h1>
          <p className="mt-1 text-lg font-medium text-brand-100">อินเทอร์เน็ต · โทรศัพท์</p>
          <p className="mt-3 max-w-md text-brand-100">เบิกค่าอินเทอร์เน็ตของทุกศูนย์และค่าโทรศัพท์ในที่เดียว แทนกระดาษและตารางเขียนมือ</p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-brand-50">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-200">ระบบภายในบริษัท</p>
      </section>

      <section className="flex items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Image src="/logo-ki-mark.png" alt="KI" width={258} height={128} className="mb-3 h-10 w-auto" priority />
            <div className="text-xl font-bold text-slate-900">ระบบเบิกค่าบริการ</div>
            <div className="text-sm text-slate-500">อินเทอร์เน็ต · โทรศัพท์</div>
            <div className="text-sm text-slate-500">บริษัท น้ำตาลสุรินทร์ จำกัด</div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">เข้าสู่ระบบ</h2>
          <p className="mt-1 text-sm text-slate-500">ใช้ชื่อผู้ใช้และรหัสผ่านที่ได้รับจากผู้ดูแลระบบ</p>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <LoginForm />
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">ลืมรหัสผ่าน ติดต่อผู้ดูแลระบบเพื่อรีเซ็ต</p>
        </div>
      </section>
    </main>
  );
}
