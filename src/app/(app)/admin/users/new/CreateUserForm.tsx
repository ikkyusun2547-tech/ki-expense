"use client";

import { useActionState } from "react";
import { Alert, Button, ButtonLink, Field, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { ROLE_LABEL } from "@/lib/status";
import { createUser } from "@/server/actions/users";
import { TempPasswordNotice } from "../TempPasswordNotice";

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, initialFormState);
  const errors = state.fieldErrors ?? {};
  const v = state.values;

  if (state.tempPassword) {
    return (
      <div className="flex flex-col gap-4">
        <TempPasswordNotice message={state.message} password={state.tempPassword} />
        <div>
          <ButtonLink href="/admin/users">กลับไปรายชื่อผู้ใช้</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {state.error && (
        <div className="sm:col-span-2">
          <Alert tone="error">{state.error}</Alert>
        </div>
      )}
      <Field label="ชื่อผู้ใช้" htmlFor="username" errors={errors.username} hint="ใช้ล็อกอิน a-z 0-9 . _ - (3-32 ตัว)">
        <input id="username" name="username" defaultValue={v?.username} required autoCapitalize="none" aria-invalid={!!errors.username} className={`${inputClass} font-mono`} />
      </Field>
      <Field label="บทบาท" htmlFor="role" errors={errors.role}>
        <select id="role" name="role" defaultValue={v?.role ?? "CREATOR"} className={inputClass}>
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="ชื่อ-นามสกุล" htmlFor="name" errors={errors.name}>
        <input id="name" name="name" defaultValue={v?.name} required aria-invalid={!!errors.name} className={inputClass} />
      </Field>
      <Field label="อีเมล" htmlFor="email" errors={errors.email} hint="ไม่บังคับ">
        <input id="email" name="email" type="email" defaultValue={v?.email} aria-invalid={!!errors.email} className={inputClass} />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังสร้าง…" : "สร้างบัญชี"}
        </Button>
        <ButtonLink href="/admin/users" variant="secondary">
          ยกเลิก
        </ButtonLink>
      </div>
    </form>
  );
}
