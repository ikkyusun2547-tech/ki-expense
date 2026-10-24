"use client";

import { useActionState } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { MAX_PAYMENT_REF } from "@/lib/rules/paymentRules";
import { recordPayment } from "@/server/actions/accounting";

// today มาจากเซิร์ฟเวอร์ (เวลาไทย) ไม่ใช้นาฬิกาเครื่องผู้ใช้
export function PayForm({ id, today, returnTo }: { id: string; today: string; returnTo: "list" | "detail" }) {
  const [state, action, pending] = useActionState(recordPayment, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("บันทึกการจ่าย? หลังบันทึกแล้วใบเบิกจะถูกล็อก แก้ไขไม่ได้")) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="วันที่จ่ายจริง" htmlFor={`paidDate-${id}`} errors={errors.paidDate}>
        <input
          id={`paidDate-${id}`}
          name="paidDate"
          type="date"
          max={today}
          defaultValue={state.values?.paidDate ?? today}
          required
          aria-invalid={!!errors.paidDate}
          className={inputClass}
        />
      </Field>
      <Field label="เลขอ้างอิงการจ่าย" htmlFor={`paymentRef-${id}`} errors={errors.paymentRef}>
        <input
          id={`paymentRef-${id}`}
          name="paymentRef"
          defaultValue={state.values?.paymentRef}
          required
          maxLength={MAX_PAYMENT_REF}
          aria-invalid={!!errors.paymentRef}
          className={`${inputClass} tabular-nums`}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "กำลังบันทึก…" : "บันทึกการจ่าย"}
      </Button>
    </form>
  );
}
