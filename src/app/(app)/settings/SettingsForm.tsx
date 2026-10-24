"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { MemoSettings } from "@/lib/pdf/memoData";
import { updateReportSettings } from "@/server/actions/settings";

// ข้อความคงที่บนบันทึกภายใน — ตั้งครั้งเดียว จึงรวมเป็นฟอร์มเดียวไม่แบ่งขั้น
export function SettingsForm({ settings }: { settings: MemoSettings }) {
  const [state, action, pending] = useActionState(updateReportSettings, {});
  const errors = state.fieldErrors ?? {};
  const v = (state.values ?? settings) as MemoSettings;

  const text = (name: keyof MemoSettings, label: string, hint?: string) => (
    <Field label={label} htmlFor={name} errors={errors[name]} hint={hint}>
      <input id={name} name={name} defaultValue={v[name]} aria-invalid={!!errors[name]} className={inputClass} />
    </Field>
  );

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {state.message && (
        <div className="sm:col-span-2">
          <Alert tone="success">{state.message}</Alert>
        </div>
      )}
      {text("department", "จาก (ชื่อฝ่าย)")}
      {text("purpose", "เพื่อ")}
      <div className="sm:col-span-2">{text("recipient", "เรียน")}</div>
      {text("formCode", "รหัสฟอร์ม (มุมซ้ายล่าง)")}
      {text("requesterTitle", "ตำแหน่งผู้ขออนุมัติ (สำรอง)", "ใช้เมื่อบัญชีผู้จัดทำยังไม่ได้ใส่ตำแหน่ง")}
      <div className="sm:col-span-2">
        <Button type="submit" icon={Check} disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>
    </form>
  );
}
