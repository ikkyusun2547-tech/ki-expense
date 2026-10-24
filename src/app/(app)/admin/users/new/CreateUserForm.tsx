"use client";

import { Calculator, CheckCircle, Receipt, ShieldCheck } from "lucide-react";
import { useActionState, useState } from "react";
import type { Role } from "@/generated/prisma/enums";
import { Alert, Button, ButtonLink, cx, Field, inputClass, type IconType } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { isSignerRole, ROLE_LABEL } from "@/lib/status";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";
import { createUser } from "@/server/actions/users";

const ROLE_CARDS: { role: Role; icon: IconType; description: string }[] = [
  { role: "CREATOR", icon: Receipt, description: "สร้างใบเบิก แนบใบแจ้งหนี้ พิมพ์ และส่งขออนุมัติ" },
  { role: "APPROVER", icon: CheckCircle, description: "อนุมัติ / ไม่อนุมัติใบเบิกที่เลือกตนเป็นผู้อนุมัติ" },
  { role: "ACCOUNTING", icon: Calculator, description: "รับใบเบิกที่อนุมัติแล้ว บันทึกวันที่จ่ายและเลขอ้างอิง" },
  { role: "ADMIN", icon: ShieldCheck, description: "จัดการผู้ใช้ ทะเบียนศูนย์ ตั้งค่าใบเบิก ย้อนสถานะ" },
];

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, initialFormState);
  const errors = state.fieldErrors ?? {};
  const v = state.values;
  const [role, setRole] = useState<Role>((v?.role as Role) || "CREATOR");
  const needsTitle = isSignerRole(role);

  return (
    <form action={action} className="flex flex-col gap-8">
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <fieldset>
        <legend className="mb-3 text-sm font-medium text-slate-700">สร้างบัญชีให้</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLE_CARDS.map(({ role: r, icon: Icon, description }) => (
            <label
              key={r}
              className={cx(
                "flex cursor-pointer gap-3 rounded-lg border p-4 transition",
                role === r ? "border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600" : "border-slate-200 hover:border-slate-300",
              )}
            >
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
              <Icon className={cx("mt-0.5 size-5 shrink-0", role === r ? "text-emerald-700" : "text-slate-400")} aria-hidden />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{ROLE_LABEL[r]}</span>
                <span className="block text-xs text-slate-500">{description}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.role && <p className="mt-1 text-xs text-red-700">{errors.role[0]}</p>}
      </fieldset>

      <div className="grid gap-4 border-t border-slate-100 pt-8 sm:grid-cols-2">
        <Field label="ชื่อ-นามสกุล" htmlFor="name" errors={errors.name} hint="ใส่คำนำหน้าด้วย เช่น นาย / นางสาว — พิมพ์ในใบเบิกตามนี้">
          <input id="name" name="name" defaultValue={v?.name} required aria-invalid={!!errors.name} className={inputClass} />
        </Field>
        <Field
          label={needsTitle ? "ตำแหน่ง" : "ตำแหน่ง (ไม่บังคับ)"}
          htmlFor="title"
          errors={errors.title}
          hint={needsTitle ? "พิมพ์ใต้ชื่อในใบเบิก" : undefined}
        >
          <input id="title" name="title" defaultValue={v?.title} required={needsTitle} aria-invalid={!!errors.title} className={inputClass} />
        </Field>
        <Field label="อีเมล" htmlFor="email" errors={errors.email} hint="ไม่บังคับ">
          <input id="email" name="email" type="email" defaultValue={v?.email} aria-invalid={!!errors.email} className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-4 border-t border-slate-100 pt-8 sm:grid-cols-2">
        <Field label="ชื่อผู้ใช้ (ใช้ล็อกอิน)" htmlFor="username" errors={errors.username} hint="a-z 0-9 . _ - (3-32 ตัว)">
          <input
            id="username"
            name="username"
            defaultValue={v?.username}
            required
            autoCapitalize="none"
            autoComplete="off"
            aria-invalid={!!errors.username}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <div className="hidden sm:block" />
        <Field label="รหัสผ่านเริ่มต้น" htmlFor="password" errors={errors.password} hint={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}>
          <input id="password" name="password" type="password" required autoComplete="new-password" aria-invalid={!!errors.password} className={inputClass} />
        </Field>
        <Field label="ยืนยันรหัสผ่าน" htmlFor="confirmPassword" errors={errors.confirmPassword}>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            className={inputClass}
          />
        </Field>
        <p className="text-xs text-slate-500 sm:col-span-2">
          แจ้งชื่อผู้ใช้และรหัสผ่านนี้ให้เจ้าของบัญชี — ระบบจะให้ตั้งรหัสใหม่เองตอนล็อกอินครั้งแรก
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังสร้าง…" : `สร้างบัญชี${ROLE_LABEL[role]}`}
        </Button>
        <ButtonLink href="/admin/users" variant="secondary">
          ยกเลิก
        </ButtonLink>
      </div>
    </form>
  );
}
