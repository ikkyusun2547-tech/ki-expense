"use client";

import { Check, X } from "lucide-react";
import { useActionState } from "react";
import { Alert, Button, ButtonLink, Field, inputClass, Select } from "@/components/ui";
import { ProviderSelect } from "@/components/ProviderSelect";
import { INTERNET_PROVIDERS } from "@/lib/centers/phone";
import { initialFormState } from "@/lib/formState";
import { INTERNET_PROVIDER } from "@/lib/pdf/memoData";
import { CENTER_STATUS_LABEL } from "@/lib/status";
import { saveCenter } from "@/server/actions/centers";

export type CenterFormValues = {
  id?: string;
  customerCode: string;
  serviceNumber: string;
  provider: string;
  name: string;
  normalAmount: string;
  dueDay: string;
  status: string;
};

const EMPTY: CenterFormValues = {
  customerCode: "",
  serviceNumber: "",
  provider: INTERNET_PROVIDER,
  name: "",
  normalAmount: "",
  dueDay: "",
  status: "ACTIVE",
};

export function CenterForm({ center = EMPTY }: { center?: CenterFormValues }) {
  const [state, action, pending] = useActionState(saveCenter, initialFormState);
  const errors = state.fieldErrors ?? {};
  const v = state.values ?? center;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {center.id && <input type="hidden" name="id" value={center.id} />}
      {state.error && (
        <div className="sm:col-span-2">
          <Alert tone="error">{state.error}</Alert>
        </div>
      )}

      <Field label="รหัสลูกค้า" htmlFor="customerCode" errors={errors.customerCode} hint="ใช้ค้นหาตอนสร้างใบเบิก ต้องไม่ซ้ำ">
        <input id="customerCode" name="customerCode" defaultValue={v.customerCode} required aria-invalid={!!errors.customerCode} className={`${inputClass} tabular-nums`} />
      </Field>
      <Field label="หมายเลขบริการ" htmlFor="serviceNumber" errors={errors.serviceNumber} hint="ไม่บังคับ">
        <input id="serviceNumber" name="serviceNumber" defaultValue={v.serviceNumber} aria-invalid={!!errors.serviceNumber} className={`${inputClass} tabular-nums`} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="ชื่อศูนย์" htmlFor="name" errors={errors.name}>
          <input id="name" name="name" defaultValue={v.name} required aria-invalid={!!errors.name} className={inputClass} />
        </Field>
      </div>
      <Field label="ยอดปกติต่อเดือน (บาท)" htmlFor="normalAmount" errors={errors.normalAmount}>
        <input id="normalAmount" name="normalAmount" inputMode="decimal" defaultValue={v.normalAmount} required aria-invalid={!!errors.normalAmount} className={`${inputClass} tabular-nums`} />
      </Field>
      <Field label="วันครบกำหนดประจำเดือน" htmlFor="dueDay" errors={errors.dueDay} hint="วันที่ 1-31">
        <input id="dueDay" name="dueDay" type="number" min={1} max={31} defaultValue={v.dueDay} required aria-invalid={!!errors.dueDay} className={`${inputClass} tabular-nums`} />
      </Field>
      <Field label="สถานะ" htmlFor="status" errors={errors.status} hint="ศูนย์ที่ย้าย/ปิด จะเบิกไม่ได้">
        <Select id="status" name="status" defaultValue={v.status}>
          {Object.entries(CENTER_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="ระบบ (ค่าย)" htmlFor="provider" errors={errors.provider} hint="พิมพ์ในใบเบิก">
        <ProviderSelect id="provider" name="provider" options={INTERNET_PROVIDERS} defaultValue={v.provider} invalid={!!errors.provider} />
      </Field>

      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" icon={Check} disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
        <ButtonLink href="/admin/centers" variant="secondary" icon={X}>
          ยกเลิก
        </ButtonLink>
      </div>
    </form>
  );
}
