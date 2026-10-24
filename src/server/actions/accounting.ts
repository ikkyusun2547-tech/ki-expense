"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/formState";
import { checkPayment } from "@/lib/rules/paymentRules";
import { todayISO } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { payRequest } from "@/server/services/requests";

// ฝ่ายบัญชีบันทึกวันที่จ่าย + เลขอ้างอิง → สถานะ "จ่ายแล้ว"
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

// บันทึกจ่ายทีละหลายใบด้วยวันที่จ่าย + เลขอ้างอิงเดียวกัน (เช่น โอนรวมครั้งเดียว)
// ตรวจวันที่/เลขอ้างอิงครั้งเดียวก่อน แล้วบันทึกทีละใบ (ใบที่สถานะเปลี่ยนไปแล้วข้ามไป แล้วแจ้งจำนวน)
export async function payMany(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("ACCOUNTING");

  const ids = [...new Set(formData.getAll("ids").map(String))].filter(Boolean);
  const values = { paidDate: String(formData.get("paidDate") ?? ""), paymentRef: String(formData.get("paymentRef") ?? "") };
  if (ids.length === 0) return { error: "เลือกใบเบิกที่จะบันทึกการจ่ายก่อน", values };

  const today = todayISO();
  const check = checkPayment(values, today);
  if (!check.ok) {
    return { fieldErrors: Object.fromEntries(Object.entries(check.errors).map(([k, v]) => [k, [v]])), values };
  }

  let ok = 0;
  for (const requestId of ids) {
    if ((await payRequest({ requestId, input: values, today, actor })).ok) ok++;
  }
  redirect(`/accounting?paid=${ok}${ok < ids.length ? `&fail=${ids.length - ok}` : ""}`);
}
