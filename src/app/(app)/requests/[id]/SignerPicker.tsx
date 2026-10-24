"use client";

import { Check } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { changeRequestSigners } from "@/server/actions/requests";

export type SignerOption = { value: string; label: string; title: string };
export type SignerSlot = { value: string; options: SignerOption[] };

// เลือกผู้ขออนุมัติ/ผู้อนุมัติที่จะพิมพ์ในใบเบิก — ตัวเลือกแรกคือค่าเริ่มต้นจากหน้าตั้งค่า
export function SignerPicker({ id, requester, approver, saved }: { id: string; requester: SignerSlot; approver: SignerSlot; saved: boolean }) {
  const [state, action, pending] = useActionState(changeRequestSigners, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {saved && !state.error && <Alert tone="success">บันทึกผู้ลงนามแล้ว — พิมพ์ใบเบิกหรือกดส่งขออนุมัติได้เลย</Alert>}
      <SignerSelect name="requester" label="ผู้ขออนุมัติ" slot={requester} />
      <SignerSelect name="approver" label="ผู้อนุมัติ" slot={approver} />
      <Button type="submit" variant="secondary" icon={Check} disabled={pending}>
        {pending ? "กำลังบันทึก…" : "บันทึกผู้ลงนาม"}
      </Button>
    </form>
  );
}

// ชื่อ + ตำแหน่งเป็นคู่กัน: เลือกคนไหน ช่องตำแหน่งเปลี่ยนตามคนนั้นทันที (ตำแหน่งแก้ที่รายชื่อในหน้าตั้งค่า)
function SignerSelect({ name, label, slot }: { name: string; label: string; slot: SignerSlot }) {
  const [value, setValue] = useState(slot.value);
  const title = slot.options.find((o) => o.value === value)?.title;

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium text-slate-700">{label}</legend>
      <Field label="ชื่อ" htmlFor={name}>
        <select id={name} name={name} value={value} onChange={(e) => setValue(e.target.value)} className={inputClass}>
          {slot.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <div>
        <div className="text-sm font-medium text-slate-700">ตำแหน่ง</div>
        <div className="mt-1 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800" aria-live="polite">
          {title || <span className="text-slate-400">–</span>}
        </div>
      </div>
    </fieldset>
  );
}
