"use client";

import { Banknote } from "lucide-react";
import { BulkBar } from "@/components/BulkBar";
import { ThaiDateInput } from "@/components/ThaiDateInput";
import { inputClass } from "@/components/ui";
import { MAX_PAYMENT_REF } from "@/lib/rules/paymentRules";
import { payMany } from "@/server/actions/accounting";

// ฝ่ายบัญชีติ๊กหลายใบ แล้วบันทึกจ่ายด้วยวันที่ + เลขอ้างอิงเดียวกัน (เช่น โอนรวมครั้งเดียว)
// today มาจากเซิร์ฟเวอร์ (เวลาไทย)
export function BulkPay({ formId, today }: { formId: string; today: string }) {
  return (
    <BulkBar
      formId={formId}
      action={payMany}
      submitLabel="บันทึกจ่ายที่เลือก"
      icon={Banknote}
      confirmText={(n) => `บันทึกการจ่าย ${n} ใบ ด้วยวันที่และเลขอ้างอิงเดียวกัน? หลังบันทึกแล้วใบเบิกจะถูกล็อก`}
    >
      {(state) => (
        <>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            วันที่จ่าย
            <span className="w-44">
              <ThaiDateInput
                key={state.values?.paidDate ?? today}
                id="bulk-paidDate"
                name="paidDate"
                max={today}
                defaultValue={state.values?.paidDate ?? today}
                required
                invalid={!!state.fieldErrors?.paidDate}
              />
            </span>
            {state.fieldErrors?.paidDate && <span className="text-red-700">{state.fieldErrors.paidDate[0]}</span>}
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            เลขอ้างอิงการจ่าย
            <input
              name="paymentRef"
              defaultValue={state.values?.paymentRef}
              required
              maxLength={MAX_PAYMENT_REF}
              aria-invalid={!!state.fieldErrors?.paymentRef}
              className={`${inputClass} w-52 tabular-nums`}
            />
            {state.fieldErrors?.paymentRef && <span className="text-red-700">{state.fieldErrors.paymentRef[0]}</span>}
          </label>
        </>
      )}
    </BulkBar>
  );
}
