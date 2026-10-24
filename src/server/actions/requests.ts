"use server";

import { redirect } from "next/navigation";
import type { CenterStatus } from "@/generated/prisma/enums";
import type { FormState } from "@/lib/formState";
import { suggestRequest, type RequestSuggestion } from "@/lib/rules/requestDefaults";
import type { Issue } from "@/lib/rules/requestRules";
import { toISODate, todayISO } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { createRequest, setRequestSigners, transitionRequest, updateRequest, type RequestInput } from "@/server/services/requests";

export type CenterSummary = {
  id: string;
  customerCode: string;
  serviceNumber: string | null;
  name: string;
  normalAmount: string;
  dueDay: number;
  status: CenterStatus;
};

export type CenterLookup = { ok: true; center: CenterSummary; suggestion: RequestSuggestion } | { ok: false; error: string };

// ผู้จัดทำพิมพ์รหัสลูกค้า → แสดงศูนย์ + ยอดปกติ
export async function findCenterByCode(code: string): Promise<CenterLookup> {
  await requireRole("CREATOR");

  const customerCode = code.trim();
  if (!customerCode) return { ok: false, error: "กรอกรหัสลูกค้า" };

  const center = await db.center.findUnique({ where: { customerCode } });
  if (!center) return { ok: false, error: `ไม่พบรหัสลูกค้า ${customerCode} ในทะเบียนศูนย์` };

  // กรอกให้ล่วงหน้าจากใบล่าสุดของศูนย์นี้ (รอบถัดไป)
  const last = await db.request.findFirst({
    where: { centerId: center.id, deletedAt: null },
    orderBy: { periodEnd: "desc" },
    select: { periodEnd: true, dueDate: true },
  });
  const suggestion = suggestRequest(
    { normalAmount: center.normalAmount.toFixed(2), dueDay: center.dueDay },
    last && { periodEnd: toISODate(last.periodEnd), dueDate: toISODate(last.dueDate) },
    todayISO(),
  );

  return {
    ok: true,
    suggestion,
    center: {
      id: center.id,
      customerCode: center.customerCode,
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
// intent=submit → บันทึกแล้วส่งขออนุมัติต่อทันที (ต้องเลือกผู้อนุมัติ) แล้วกลับหน้าสรุปรายศูนย์ไปทำศูนย์ถัดไป
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
  };
  const upload = formData.get("invoiceFile");
  const file = upload instanceof File && upload.size > 0 ? upload : null;
  const confirmWarnings = text("confirmWarnings") === "1";
  // ไม่มีช่องผู้อนุมัติในฟอร์ม = ไม่เปลี่ยน, ช่องว่าง = ไม่เลือก
  const approverId = formData.has("approverId") ? text("approverId") || null : undefined;
  const submit = text("intent") === "submit";
  if (submit && !approverId) return { error: "เลือกผู้อนุมัติก่อนส่งขออนุมัติ" };

  const outcome = id
    ? await updateRequest({ requestId: id, input, file, confirmWarnings, approverId, actor })
    : await createRequest({ centerId: text("centerId"), input, file, confirmWarnings, approverId, actor });

  if (!outcome.ok) return { error: outcome.error, blocks: outcome.blocks, warnings: outcome.warnings };
  if (!submit) redirect(`/requests/${outcome.id}`);

  const sent = await transitionRequest({ requestId: outcome.id, action: "SUBMIT", actor });
  // บันทึกแล้วแต่ส่งไม่สำเร็จ (เช่น ผู้อนุมัติถูกปิดบัญชีพอดี) → ไปหน้าใบเบิกให้ส่งเอง
  redirect(sent.ok ? `/summary?sent=${outcome.id}` : `/requests/${outcome.id}`);
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
