"use client";

import { KeyRound } from "lucide-react";
import { useActionState } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";
import { resetPassword } from "@/server/actions/users";

export function ResetPasswordForm({ id, username }: { id: string; username: string }) {
  const [state, action, pending] = useActionState(resetPassword, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`ตั้งรหัสผ่านใหม่ให้ ${username}? ผู้ใช้จะถูกออกจากระบบทุกเครื่อง`)) e.preventDefault();
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="id" value={id} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <p className="text-sm text-slate-600">ใช้เมื่อผู้ใช้ลืมรหัสผ่าน — ตั้งรหัสใหม่แล้วแจ้งผู้ใช้ ผู้ใช้ต้องเปลี่ยนเองตอนล็อกอินครั้งถัดไป</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="รหัสผ่านใหม่" htmlFor="password" errors={errors.password} hint={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}>
          <input id="password" name="password" type="password" required autoComplete="new-password" className={inputClass} />
        </Field>
        <Field label="ยืนยันรหัสผ่าน" htmlFor="confirmPassword" errors={errors.confirmPassword}>
          <input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" className={inputClass} />
        </Field>
      </div>
      <div>
        <Button type="submit" variant="secondary" icon={KeyRound} disabled={pending}>
          {pending ? "กำลังบันทึก…" : "ตั้งรหัสผ่านใหม่"}
        </Button>
      </div>
    </form>
  );
}
