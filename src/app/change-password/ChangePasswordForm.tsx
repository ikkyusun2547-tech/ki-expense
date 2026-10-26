"use client";

import { KeyRound } from "lucide-react";
import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";
import { changePassword } from "@/server/actions/auth";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="รหัสผ่านปัจจุบัน" htmlFor="currentPassword" errors={errors.currentPassword}>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!errors.currentPassword}
          className={inputClass}
        />
      </Field>
      <Field
        label="รหัสผ่านใหม่"
        htmlFor="newPassword"
        errors={errors.newPassword}
        hint={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}
      >
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          aria-invalid={!!errors.newPassword}
          className={inputClass}
        />
      </Field>
      <Field label="ยืนยันรหัสผ่านใหม่" htmlFor="confirmPassword" errors={errors.confirmPassword}>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!errors.confirmPassword}
          className={inputClass}
        />
      </Field>
      <Button type="submit" icon={KeyRound} disabled={pending}>
        {pending ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
      </Button>
    </form>
  );
}
