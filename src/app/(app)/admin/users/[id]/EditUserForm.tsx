"use client";

import { useActionState } from "react";
import { Alert, Button, ButtonLink, Field, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { ROLE_LABEL } from "@/lib/status";
import { updateUser } from "@/server/actions/users";

export type EditUserValues = {
  id: string;
  username: string;
  name: string;
  title: string;
  email: string;
  role: string;
  active: string; // "true" | "false"
};

export function EditUserForm({ user, isSelf }: { user: EditUserValues; isSelf: boolean }) {
  const [state, action, pending] = useActionState(updateUser, initialFormState);
  const errors = state.fieldErrors ?? {};
  const v = state.values ?? user;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={user.id} />
      {state.error && (
        <div className="sm:col-span-2">
          <Alert tone="error">{state.error}</Alert>
        </div>
      )}
      <Field label="ชื่อผู้ใช้ (ใช้ล็อกอิน)" htmlFor="username" errors={errors.username} hint="a-z 0-9 . _ - (3-32 ตัว) — เปลี่ยนแล้วต้องแจ้งเจ้าของบัญชี">
        <input
          id="username"
          name="username"
          defaultValue={v.username}
          required
          autoCapitalize="none"
          autoComplete="off"
          aria-invalid={!!errors.username}
          className={`${inputClass} tabular-nums`}
        />
      </Field>
      <div className="hidden sm:block" />
      <Field label="ชื่อ-นามสกุล" htmlFor="name" errors={errors.name}>
        <input id="name" name="name" defaultValue={v.name} required aria-invalid={!!errors.name} className={inputClass} />
      </Field>
      <Field label="ตำแหน่ง" htmlFor="title" errors={errors.title} hint="พิมพ์ใต้ชื่อในใบเบิก — บังคับสำหรับผู้จัดทำและผู้อนุมัติ">
        <input id="title" name="title" defaultValue={v.title} aria-invalid={!!errors.title} className={inputClass} />
      </Field>
      <Field label="อีเมล" htmlFor="email" errors={errors.email} hint="ไม่บังคับ">
        <input id="email" name="email" type="email" defaultValue={v.email} aria-invalid={!!errors.email} className={inputClass} />
      </Field>
      <Field label="บทบาท" htmlFor="role" errors={errors.role} hint={isSelf ? "เปลี่ยนบทบาทของตัวเองไม่ได้" : undefined}>
        <select id="role" name="role" defaultValue={v.role} disabled={isSelf} className={inputClass}>
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {/* select ที่ disabled ไม่ถูกส่งไปกับฟอร์ม จึงส่งค่าเดิมแทน */}
        {isSelf && <input type="hidden" name="role" value={user.role} />}
      </Field>
      <Field label="สถานะบัญชี" htmlFor="active" hint={isSelf ? "ปิดบัญชีของตัวเองไม่ได้" : "ปิดใช้งานแล้วผู้ใช้จะถูกออกจากระบบทันที"}>
        <select id="active" name="active" defaultValue={v.active} disabled={isSelf} className={inputClass}>
          <option value="true">ใช้งาน</option>
          <option value="false">ปิดใช้งาน</option>
        </select>
        {isSelf && <input type="hidden" name="active" value="true" />}
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
        <ButtonLink href="/admin/users" variant="secondary">
          ยกเลิก
        </ButtonLink>
      </div>
    </form>
  );
}
