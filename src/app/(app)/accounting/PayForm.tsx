"use client";

import { Banknote } from "lucide-react";
import { useActionState } from "react";
import { ThaiDateInput } from "@/components/ThaiDateInput";
import { Alert, Button, cx, Field, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { MAX_PAYMENT_REF } from "@/lib/rules/paymentRules";
import { recordPayment } from "@/server/actions/accounting";

// today มาจากเซิร์ฟเวอร์ (เวลาไทย) ไม่ใช้นาฬิกาเครื่องผู้ใช้
// suffix: แยก id ของช่องเมื่อฟอร์มเดียวกันแสดง 2 ที่ (การ์ดจอเล็ก + ตารางจอใหญ่)
// compact: แบบบรรทัดเดียวในแถวรายการ (พิมพ์เลขอ้างอิงแล้วกดบันทึกได้เลย วันที่จ่าย = วันนี้ แก้ได้)
export function PayForm({
  id,
  today,
  returnTo,
  suffix = "",
  compact = false,
}: {
  id: string;
  today: string;
  returnTo: "list" | "detail";
  suffix?: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(recordPayment, initialFormState);
  const errors = state.fieldErrors ?? {};
  const dateId = `paidDate-${id}${suffix}`;
  const refId = `paymentRef-${id}${suffix}`;

  const dateInput = (
    <ThaiDateInput
      key={state.values?.paidDate ?? today}
      id={dateId}
      name="paidDate"
      max={today}
      defaultValue={state.values?.paidDate ?? today}
      required
      invalid={!!errors.paidDate}
    />
  );
  const refInput = (
    <input
      id={refId}
      name="paymentRef"
      defaultValue={state.values?.paymentRef}
      required
      maxLength={MAX_PAYMENT_REF}
      placeholder={compact ? "เลขอ้างอิงการจ่าย" : undefined}
      aria-label={compact ? "เลขอ้างอิงการจ่าย" : undefined}
      aria-invalid={!!errors.paymentRef}
      className={`${inputClass} tabular-nums`}
    />
  );

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("บันทึกการจ่าย? หลังบันทึกแล้วใบเบิกจะถูกล็อก แก้ไขไม่ได้")) e.preventDefault();
      }}
      className={cx("flex", compact ? "flex-col gap-1" : "flex-col gap-3")}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {compact ? (
        <>
          <div className="flex items-center gap-2">
            <div className="w-36 shrink-0" title="วันที่จ่าย">
              {dateInput}
            </div>
            <div className="min-w-0 flex-1">{refInput}</div>
            <Button type="submit" icon={Banknote} disabled={pending} className="shrink-0">
              {pending ? "กำลังบันทึก…" : "บันทึกจ่าย"}
            </Button>
          </div>
          {(errors.paidDate || errors.paymentRef) && (
            <p className="text-xs text-red-700">{[...(errors.paidDate ?? []), ...(errors.paymentRef ?? [])].join(" · ")}</p>
          )}
        </>
      ) : (
        <>
          <Field label="วันที่จ่ายจริง" htmlFor={dateId} errors={errors.paidDate}>
            {dateInput}
          </Field>
          <Field label="เลขอ้างอิงการจ่าย" htmlFor={refId} errors={errors.paymentRef}>
            {refInput}
          </Field>
          <Button type="submit" icon={Banknote} disabled={pending}>
            {pending ? "กำลังบันทึก…" : "บันทึกการจ่าย"}
          </Button>
        </>
      )}
    </form>
  );
}
