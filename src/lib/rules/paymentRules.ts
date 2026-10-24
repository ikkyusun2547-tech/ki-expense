import { isISODate, type ISODate } from "@/lib/thai/date";

// ตรวจข้อมูลการจ่ายที่ฝ่ายบัญชีบันทึก (วันที่จ่าย + เลขอ้างอิง บังคับทั้งคู่)

export const MAX_PAYMENT_REF = 100;

export type PaymentInput = { paidDate: string; paymentRef: string };

export type PaymentCheck =
  | { ok: true; paidDate: ISODate; paymentRef: string }
  | { ok: false; errors: { paidDate?: string; paymentRef?: string } };

export function checkPayment(input: PaymentInput, today: ISODate): PaymentCheck {
  const paidDate = input.paidDate.trim();
  const paymentRef = input.paymentRef.trim();
  const errors: { paidDate?: string; paymentRef?: string } = {};

  if (!paidDate) errors.paidDate = "กรอกวันที่จ่าย";
  else if (!isISODate(paidDate)) errors.paidDate = "วันที่จ่ายไม่ถูกต้อง";
  else if (paidDate > today) errors.paidDate = "วันที่จ่ายต้องไม่เกินวันนี้";

  if (!paymentRef) errors.paymentRef = "กรอกเลขอ้างอิงการจ่าย";
  else if (paymentRef.length > MAX_PAYMENT_REF) errors.paymentRef = `เลขอ้างอิงยาวเกิน ${MAX_PAYMENT_REF} ตัวอักษร`;

  if (errors.paidDate || errors.paymentRef) return { ok: false, errors };
  return { ok: true, paidDate, paymentRef };
}
