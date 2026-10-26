"use client";

import { useActionState } from "react";
import { Alert, Button, ButtonLink, Field, inputClass } from "@/components/ui";
import { DEFAULT_PROVIDER, PROVIDER_SUGGESTIONS } from "@/lib/centers/phone";
import { initialFormState } from "@/lib/formState";
import { PHONE_STATUS_LABEL } from "@/lib/status";
import { savePhone } from "@/server/actions/centers";

export type PhoneFormValues = {
  id?: string;
  phoneNumber: string;
  provider: string;
  accountCode: string;
  name: string;
  normalAmount: string;
  dueDay: string;
  status: string;
};

const EMPTY: PhoneFormValues = {
  phoneNumber: "",
  provider: DEFAULT_PROVIDER,
  accountCode: "",
  name: "",
  normalAmount: "",
  dueDay: "",
  status: "ACTIVE",
};

export function PhoneForm({ phone = EMPTY }: { phone?: PhoneFormValues }) {
  const [state, action, pending] = useActionState(savePhone, initialFormState);
  const errors = state.fieldErrors ?? {};
  const v = state.values ?? phone;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {phone.id && <input type="hidden" name="id" value={phone.id} />}
      {state.error && (
        <div className="sm:col-span-2">
          <Alert tone="error">{state.error}</Alert>
        </div>
      )}

      <Field label="หมายเลขโทรศัพท์" htmlFor="phoneNumber" errors={errors.phoneNumber} hint="ใช้ค้นหาตอนสร้างใบเบิก ต้องไม่ซ้ำ">
        <input
          id="phoneNumber"
          name="phoneNumber"
          inputMode="tel"
          placeholder="097-3378822"
          defaultValue={v.phoneNumber}
          required
          aria-invalid={!!errors.phoneNumber}
          className={`${inputClass} tabular-nums`}
        />
      </Field>
      <Field label="ระบบ" htmlFor="provider" errors={errors.provider} hint="ค่ายผู้ให้บริการ เช่น TRUE, AIS">
        <input
          id="provider"
          name="provider"
          list="provider-options"
          defaultValue={v.provider}
          required
          aria-invalid={!!errors.provider}
          className={inputClass}
        />
        <datalist id="provider-options">
          {PROVIDER_SUGGESTIONS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <Field label="ผู้ใช้บริการ" htmlFor="name" errors={errors.name} hint="ฝ่ายหรือหน่วยงานที่ใช้เบอร์ เช่น รัฐกิจสัมพันธ์">
        <input id="name" name="name" defaultValue={v.name} required aria-invalid={!!errors.name} className={inputClass} />
      </Field>
      <Field label="รหัสลูกค้า" htmlFor="accountCode" errors={errors.accountCode} hint="ตามใบแจ้งหนี้ของค่าย (ไม่บังคับ)">
        <input
          id="accountCode"
          name="accountCode"
          defaultValue={v.accountCode}
          aria-invalid={!!errors.accountCode}
          className={`${inputClass} tabular-nums`}
        />
      </Field>
      <Field label="ยอดปกติต่อเดือน (บาท)" htmlFor="normalAmount" errors={errors.normalAmount} hint="รวม VAT">
        <input
          id="normalAmount"
          name="normalAmount"
          inputMode="decimal"
          defaultValue={v.normalAmount}
          required
          aria-invalid={!!errors.normalAmount}
          className={`${inputClass} tabular-nums`}
        />
      </Field>
      <Field label="วันครบกำหนดประจำเดือน" htmlFor="dueDay" errors={errors.dueDay} hint="วันที่ 1-31">
        <input
          id="dueDay"
          name="dueDay"
          type="number"
          min={1}
          max={31}
          defaultValue={v.dueDay}
          required
          aria-invalid={!!errors.dueDay}
          className={`${inputClass} tabular-nums`}
        />
      </Field>
      <Field label="สถานะ" htmlFor="status" errors={errors.status} hint="เบอร์ที่ยกเลิกแล้ว จะเบิกไม่ได้">
        <select id="status" name="status" defaultValue={v.status} className={inputClass}>
          {Object.entries(PHONE_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
        <ButtonLink href="/admin/phones" variant="secondary">
          ยกเลิก
        </ButtonLink>
      </div>
    </form>
  );
}
