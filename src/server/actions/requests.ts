"use server";

import { redirect } from "next/navigation";
import type { CenterStatus } from "@/generated/prisma/enums";
import type { FormState } from "@/lib/formState";
import type { Issue } from "@/lib/rules/requestRules";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { createRequest, transitionRequest, updateRequest, type RequestInput } from "@/server/services/requests";

export type CenterSummary = {
  id: string;
  customerCode: string;
  serviceNumber: string | null;
  name: string;
  normalAmount: string;
  dueDay: number;
  status: CenterStatus;
};

export type CenterLookup = { ok: true; center: CenterSummary } | { ok: false; error: string };

// ผู้จัดทำพิมพ์รหัสลูกค้า → แสดงศูนย์ + ยอดปกติ
export async function findCenterByCode(code: string): Promise<CenterLookup> {
  await requireRole("CREATOR");

  const customerCode = code.trim();
  if (!customerCode) return { ok: false, error: "กรอกรหัสลูกค้า" };

  const center = await db.center.findUnique({ where: { customerCode } });
  if (!center) return { ok: false, error: `ไม่พบรหัสลูกค้า ${customerCode} ในทะเบียนศูนย์` };

  return {
    ok: true,
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

  const outcome = id
    ? await updateRequest({ requestId: id, input, file, confirmWarnings, actor })
    : await createRequest({ centerId: text("centerId"), input, file, confirmWarnings, actor });

  if (!outcome.ok) return { error: outcome.error, blocks: outcome.blocks, warnings: outcome.warnings };
  redirect(`/requests/${outcome.id}`);
}

const TRANSITIONS = ["SEND", "DELETE", "REVERT"] as const;

// ปุ่มเปลี่ยนสถานะในหน้ารายละเอียด — สิทธิ์ละเอียดตรวจซ้ำใน service ตาม state machine
export async function changeRequestStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("CREATOR", "ADMIN");

  const requestId = String(formData.get("id") ?? "");
  const action = TRANSITIONS.find((a) => a === formData.get("action"));
  if (!action) return { error: "คำสั่งไม่ถูกต้อง" };

  const outcome = await transitionRequest({ requestId, action, actor, note: String(formData.get("note") ?? "") });
  if (!outcome.ok) return { error: outcome.error };

  redirect(action === "DELETE" ? "/requests" : `/requests/${requestId}`);
}
