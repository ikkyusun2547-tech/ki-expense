"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { resetPassword } from "@/server/actions/users";
import { TempPasswordNotice } from "../TempPasswordNotice";

export function ResetPasswordForm({ id, username }: { id: string; username: string }) {
  const [state, action, pending] = useActionState(resetPassword, initialFormState);

  if (state.tempPassword) return <TempPasswordNotice message={state.message} password={state.tempPassword} />;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`รีเซ็ตรหัสผ่านของ ${username}? ผู้ใช้จะถูกออกจากระบบทุกเครื่อง`)) e.preventDefault();
      }}
      className="flex flex-col items-start gap-3"
    >
      <input type="hidden" name="id" value={id} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <p className="text-sm text-zinc-600">ใช้เมื่อผู้ใช้ลืมรหัสผ่าน ระบบจะสร้างรหัสชั่วคราวใหม่ให้</p>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "กำลังรีเซ็ต…" : "รีเซ็ตรหัสผ่าน"}
      </Button>
    </form>
  );
}
