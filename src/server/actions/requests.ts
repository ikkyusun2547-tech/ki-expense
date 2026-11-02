"use server";

import { redirect } from "next/navigation";
import type { CenterStatus, ServiceKind } from "@/generated/prisma/enums";
import { normalizePhone } from "@/lib/centers/phone";
import type { FormState } from "@/lib/formState";
import { packageFromNormal, phoneCharges } from "@/lib/rules/phoneCharges";
import { suggestRequest, type RequestSuggestion } from "@/lib/rules/requestDefaults";
import type { Issue } from "@/lib/rules/requestRules";
import { fieldErrorsOf, memoTextsSchema } from "@/lib/validation";
import { toISODate, todayISO } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import {
  createRequest,
  setRequestSigners,
  transferOpenRequests,
  transferRequest,
  transitionRequest,
  updateRequest,
  type RequestInput,
} from "@/server/services/requests";

export type CenterSummary = {
  id: string;
  kind: ServiceKind;
  customerCode: string;
  provider: string;
  serviceNumber: string | null;
  name: string;
  normalAmount: string;
  dueDay: number;
  status: CenterStatus;
};

export type CenterLookup = { ok: true; center: CenterSummary; suggestion: RequestSuggestion } | { ok: false; error: string };

// ผู้จัดทำพิมพ์รหัสลูกค้า (อินเทอร์เน็ต) หรือเบอร์โทรศัพท์ (ช่องเดียว) → แสดงศูนย์/เบอร์ + ยอดปกติ — ประเภทใบเบิกตามที่เจอ
// ตรงตัวก่อน (รหัสลูกค้า / เบอร์ที่พิมพ์เป็นตัวเลขล้วน) ไม่เจอค่อยลองอ่านเป็นเบอร์ (097-3378822, +66…)
export async function findCenterByCode(code: string): Promise<CenterLookup> {
  await requireRole("CREATOR");

  const customerCode = code.trim();
  if (!customerCode) return { ok: false, error: "กรอกรหัสลูกค้าหรือเบอร์โทรศัพท์" };

  const phone = normalizePhone(customerCode);
  const center =
    (await db.center.findUnique({ where: { customerCode } })) ??
    (phone ? await db.center.findFirst({ where: { customerCode: phone, kind: "PHONE" } }) : null);
  if (!center) return { ok: false, error: `ไม่พบ ${customerCode} ในทะเบียนศูนย์หรือทะเบียนเบอร์โทรศัพท์` };

  // กรอกให้ล่วงหน้าจากใบล่าสุดของศูนย์นี้ (รอบถัดไป)
  const last = await db.request.findFirst({
    where: { centerId: center.id, deletedAt: null },
    orderBy: { periodEnd: "desc" },
    select: { periodEnd: true, dueDate: true, packageAmount: true },
  });
  const base = suggestRequest(
    { normalAmount: center.normalAmount.toFixed(2), dueDay: center.dueDay },
    last && { periodEnd: toISODate(last.periodEnd), dueDate: toISODate(last.dueDate) },
    todayISO(),
  );
  // ค่าโทรศัพท์: แพ็กเกจหลักตามใบล่าสุดของเบอร์นี้ (ไม่เคยเบิก = ยอดปกติในทะเบียนถอด VAT), ส่วนเกิน = 0
  const packageAmount = center.kind === "PHONE" ? (last?.packageAmount?.toFixed(2) ?? packageFromNormal(center.normalAmount.toFixed(2))) : null;
  const suggestion: RequestSuggestion = packageAmount
    ? { ...base, packageAmount, extraAmount: "0.00", amount: phoneCharges(packageAmount, "0")!.total }
    : base;

  return {
    ok: true,
    suggestion,
    center: {
      id: center.id,
      kind: center.kind,
      customerCode: center.customerCode,
      provider: center.provider,
      serviceNumber: center.serviceNumber,
      name: center.name,
      normalAmount: center.normalAmount.toFixed(2),
      dueDay: center.dueDay,
      status: center.status,
    },
  };
}

export type RequestFormState = {
  error?: string;
  blocks?: Issue[];
  warnings?: Issue[];
};

// สร้าง (ไม่มี id) หรือแก้ไข (มี id) ใบเบิก; ถ้ามีคำเตือนต้องส่ง confirmWarnings=1 มาอีกรอบ
// intent=submit → บันทึกแล้วส่งขออนุมัติต่อทันที (ต้องเลือกผู้อนุมัติ) แล้วกลับหน้าการ์ดศูนย์ไปทำศูนย์ถัดไป
export async function saveRequest(_prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const actor = await requireRole("CREATOR");

  const text = (key: string) => String(formData.get(key) ?? "");
  const id = text("id");
  const input: RequestInput = {
    invoiceNo: text("invoiceNo"),
    amount: text("amount"),
    periodStart: text("periodStart"),
    periodEnd: text("periodEnd"),
    dueDate: text("dueDate"),
    // ค่าโทรศัพท์เท่านั้น (ฟอร์มค่าอินเทอร์เน็ตไม่มีสองช่องนี้)
    packageAmount: text("packageAmount"),
    extraAmount: text("extraAmount"),
  };
  const upload = formData.get("invoiceFile");
  const file = upload instanceof File && upload.size > 0 ? upload : null;
  const confirmWarnings = text("confirmWarnings") === "1";
  // ผู้ลงนาม: ไม่มีช่องในฟอร์ม = ไม่เปลี่ยน, ช่องว่าง = ค่าเริ่มต้น (ผู้ขอ = ผู้จัดทำ, ผู้อนุมัติ = ยังไม่เลือก)
  const optional = (key: string) => (formData.has(key) ? text(key) || null : undefined);
  const approverId = optional("approverId");
  const requesterId = optional("requesterId");
  // จาก / เรียน / เพื่อ ของใบนี้ — ไม่มีในฟอร์ม = ไม่เปลี่ยน (สร้างใหม่ = ข้อความตามฟอร์มจริง)
  const texts = formData.has("department")
    ? memoTextsSchema.safeParse({ department: text("department"), recipient: text("recipient"), purpose: text("purpose") })
    : null;
  if (texts && !texts.success) return { error: Object.values(fieldErrorsOf(texts.error)).flat()[0] };
  const submit = text("intent") === "submit";
  if (submit && !approverId) return { error: "เลือกผู้อนุมัติก่อนส่งขออนุมัติ" };

  const outcome = id
    ? await updateRequest({ requestId: id, input, file, confirmWarnings, approverId, requesterId, texts: texts?.data, actor })
    : await createRequest({ centerId: text("centerId"), input, file, confirmWarnings, approverId, requesterId, texts: texts?.data, actor });

  if (!outcome.ok) return { error: outcome.error, blocks: outcome.blocks, warnings: outcome.warnings };
  if (!submit) redirect(`/requests/${outcome.id}`);

  const sent = await transitionRequest({ requestId: outcome.id, action: "SUBMIT", actor });
  // บันทึกแล้วแต่ส่งไม่สำเร็จ (เช่น ผู้อนุมัติถูกปิดบัญชีพอดี) → ไปหน้าใบเบิกให้ส่งเอง
  if (!sent.ok) redirect(`/requests/${outcome.id}`);
  const { center } = await db.request.findUniqueOrThrow({ where: { id: outcome.id }, select: { center: { select: { kind: true } } } });
  redirect(`/summary?kind=${center.kind}&sent=${outcome.id}`);
}

const TRANSITIONS = ["SUBMIT", "APPROVE", "REJECT", "DELETE", "REVERT"] as const;

// หลังทำรายการ: ลบ → รายการใบเบิก, ผู้อนุมัติ → กลับคิวรออนุมัติ, อื่น ๆ → หน้าใบเบิกเดิม
const REDIRECT_AFTER: Partial<Record<(typeof TRANSITIONS)[number], string>> = {
  DELETE: "/requests",
  APPROVE: "/approvals?done=approve",
  REJECT: "/approvals?done=reject",
};

// ปุ่มเปลี่ยนสถานะในหน้ารายละเอียด — สิทธิ์ละเอียด (บทบาท/สถานะ/ผู้อนุมัติที่เลือกไว้) ตรวจซ้ำใน service
export async function changeRequestStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("CREATOR", "APPROVER", "ADMIN");

  const requestId = String(formData.get("id") ?? "");
  const action = TRANSITIONS.find((a) => a === formData.get("action"));
  if (!action) return { error: "คำสั่งไม่ถูกต้อง" };

  const outcome = await transitionRequest({ requestId, action, actor, note: String(formData.get("note") ?? "") });
  if (!outcome.ok) return { error: outcome.error };

  redirect(REDIRECT_AFTER[action] ?? `/requests/${requestId}`);
}

// เลือกผู้ขออนุมัติ/ผู้อนุมัติที่จะพิมพ์ในใบเบิกนี้ — สิทธิ์ตามสถานะตรวจซ้ำใน service
export async function changeRequestSigners(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("CREATOR", "ADMIN");

  const requestId = String(formData.get("id") ?? "");
  const outcome = await setRequestSigners({
    requestId,
    requester: String(formData.get("requester") ?? ""),
    approver: String(formData.get("approver") ?? ""),
    actor,
  });
  if (!outcome.ok) return { error: outcome.error };

  redirect(`/requests/${requestId}?signers=1`);
}

// admin โอนใบเบิกนี้ให้ผู้จัดทำคนอื่น (หน้าใบเบิก)
export async function transferRequestOwner(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("ADMIN");

  const requestId = String(formData.get("id") ?? "");
  const toUserId = String(formData.get("toUserId") ?? "");
  if (!toUserId) return { error: "เลือกผู้จัดทำที่จะรับใบเบิก" };

  const outcome = await transferRequest({ requestId, toUserId, actor });
  if (!outcome.ok) return { error: outcome.error };

  redirect(`/requests/${requestId}?transferred=1`);
}

// admin โอนใบเบิกที่ยังไม่จ่ายทั้งหมดของผู้จัดทำคนหนึ่ง (หน้าแก้ไขผู้ใช้ — เช่น ลาออก/ย้ายงาน)
export async function transferUserRequests(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("ADMIN");

  const fromUserId = String(formData.get("fromUserId") ?? "");
  const toUserId = String(formData.get("toUserId") ?? "");
  if (!toUserId) return { error: "เลือกผู้จัดทำที่จะรับใบเบิก" };

  const result = await transferOpenRequests({ fromUserId, toUserId, actor });
  if (result.ok === 0 && result.error) return { error: result.error };

  redirect(`/admin/users/${fromUserId}?transferred=${result.ok}${result.failed ? `&fail=${result.failed}` : ""}`);
}
