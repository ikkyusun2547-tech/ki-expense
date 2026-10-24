"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";
import { Alert, Button, Field, inputClass, StepTitle } from "@/components/ui";
import type { MemoSettings } from "@/lib/pdf/memoData";
import { updateReportSettings } from "@/server/actions/settings";

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
    <form action={action} className="flex flex-col gap-8">
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <section>
        <StepTitle step={1} title="หัวบันทึก" hint="ช่อง จาก / เรียน / เพื่อ ด้านบนของบันทึกภายใน" />
        <div className="grid gap-4 sm:grid-cols-2">
          {text("department", "จาก (ชื่อฝ่าย)", "ใช้ในย่อหน้า \"... ขอเบิกค่าใช้บริการอินเตอร์เน็ต\" ด้วย")}
          {text("purpose", "เพื่อ")}
          <div className="sm:col-span-2">{text("recipient", "เรียน")}</div>
        </div>
      </section>

      <section className="border-t border-slate-100 pt-8">
        <StepTitle step={2} title="ผู้ลงนาม" hint="ชื่อผู้ขออนุมัติดึงจากชื่อผู้จัดทำที่สร้างใบเบิก (แก้ที่เมนูผู้ใช้)" />
        <div className="grid gap-4 sm:grid-cols-2">
          {text("requesterTitle", "ตำแหน่งผู้ขออนุมัติ")}
          <div className="hidden sm:block" />
          {text("approverName", "ชื่อผู้อนุมัติ", "ใส่คำนำหน้าด้วย เช่น นาย / นางสาว — เว้นว่างได้ถ้าต้องการเขียนมือ")}
          {text("approverTitle", "ตำแหน่งผู้อนุมัติ")}
        </div>
      </section>

      <section className="border-t border-slate-100 pt-8">
        <StepTitle step={3} title="ท้ายกระดาษ" />
        <div className="grid gap-4 sm:grid-cols-2">{text("formCode", "รหัสฟอร์ม", "พิมพ์ที่มุมซ้ายล่างของบันทึก")}</div>
      </section>

      <div>
        <Button type="submit" icon={Check} disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
        </Button>
      </div>
    </form>
  );
}
