"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/formState";
import { todayISO } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { payRequest } from "@/server/services/requests";

// ฝ่ายบัญชีบันทึกวันที่จ่าย (+ เลขอ้างอิง ถ้ามี — ไม่บังคับ) → สถานะ "จ่ายแล้ว"
export async function recordPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("ACCOUNTING");

  const values = {
    paidDate: String(formData.get("paidDate") ?? ""),
    paymentRef: String(formData.get("paymentRef") ?? ""),
  };
  const outcome = await payRequest({
    requestId: String(formData.get("id") ?? ""),
    input: values,
    today: todayISO(),
    actor,
  });

  if (!outcome.ok) {
    const fieldErrors = Object.fromEntries(Object.entries(outcome.fieldErrors ?? {}).map(([k, v]) => [k, [v]]));
    return { error: outcome.error, fieldErrors, values };
  }
  redirect(String(formData.get("returnTo") ?? "") === "detail" ? `/requests/${formData.get("id")}` : "/accounting?paid=1");
}
