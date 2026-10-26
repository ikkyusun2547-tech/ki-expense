"use client";

import { useActionState } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { login } from "@/server/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="ชื่อผู้ใช้" htmlFor="username">
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          required
          autoFocus
          defaultValue={state.values?.username}
          className={inputClass}
        />
      </Field>
      <Field label="รหัสผ่าน" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      {/* ติ๊กไว้ให้ก่อน (เครื่องประจำตัว) — เครื่องใช้ร่วมให้เอาออก */}
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="remember" defaultChecked className="size-4 rounded border-slate-300 accent-emerald-700" />
        จดจำฉันไว้ 30 วัน <span className="text-xs text-slate-400">(ไม่ต้องติ๊กถ้าใช้เครื่องร่วมกับคนอื่น)</span>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </Button>
    </form>
  );
}
