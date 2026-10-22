import "server-only";
import { toAmountString } from "@/lib/money";
import { checkRequest, type Issue, type RequestDraft } from "@/lib/rules/requestRules";
import { checkTransition, type RequestAction } from "@/lib/status";
import { fromISODate, toISODate } from "@/lib/thai/date";
import type { CurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { isOverlapViolation } from "@/server/dbErrors";
import { removeInvoiceFile, saveInvoiceFile, type SavedFile } from "@/server/files";

// ตรรกะใบเบิกที่แตะ DB — ทุกการเปลี่ยนแปลงเขียน ApprovalLog ใน transaction เดียวกัน
// ผู้เรียก (Server Action) ต้อง requireRole ก่อน; ที่นี่ตรวจสิทธิ์ตาม state machine ซ้ำอีกชั้น

export type RequestInput = Omit<RequestDraft, "hasFile">;

export type SaveOutcome =
  | { ok: true; id: string }
  | { ok: false; blocks: Issue[]; warnings: Issue[]; error?: string };

const OVERLAP_ISSUE: Issue = {
  code: "PERIOD_OVERLAP",
  message: "มีใบเบิกของศูนย์นี้ที่รอบบริการทับกันถูกบันทึกไปก่อนหน้านี้ไม่นาน กรุณาตรวจรายการใบเบิกอีกครั้ง",
};

const MAX_INVOICE_NO = 50;

// สถานะใบเบิกถูกเปลี่ยนโดยคนอื่นระหว่างที่กำลังบันทึก
class StaleRequestError extends Error {}
const STALE_MESSAGE = "สถานะใบเบิกเปลี่ยนไประหว่างนี้ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง";

async function existingPeriods(centerId: string, excludeId?: string) {
  const rows = await db.request.findMany({
    where: { centerId, deletedAt: null, ...(excludeId && { id: { not: excludeId } }) },
    select: { periodStart: true, periodEnd: true },
  });
  return rows.map((r) => ({ periodStart: toISODate(r.periodStart), periodEnd: toISODate(r.periodEnd) }));
}

// เรียกหลัง validate ผ่านแล้วเท่านั้น (ยอด/วันที่รูปแบบถูกต้องแน่นอน)
function toDbFields(input: RequestInput) {
  return {
    invoiceNo: input.invoiceNo.trim(),
    amount: toAmountString(input.amount),
    periodStart: fromISODate(input.periodStart),
    periodEnd: fromISODate(input.periodEnd),
    dueDate: fromISODate(input.dueDate),
  };
}

// ตรวจกฎ + ตรวจไฟล์ แล้วตัดสินว่าบันทึกได้หรือยัง (คำเตือนต้องได้รับการยืนยันก่อน)
async function validate(args: {
  centerId: string;
  input: RequestInput;
  file: File | null;
  hasExistingFile: boolean;
  confirmWarnings: boolean;
  excludeRequestId?: string;
}): Promise<{ ok: true } | Extract<SaveOutcome, { ok: false }>> {
  const center = await db.center.findUnique({ where: { id: args.centerId } });
  if (!center) return { ok: false, blocks: [], warnings: [], error: "ไม่พบศูนย์นี้ในทะเบียน" };

  const draft: RequestDraft = { ...args.input, hasFile: !!args.file || args.hasExistingFile };
  const { blocks, warnings } = checkRequest(
    draft,
    { status: center.status, normalAmount: center.normalAmount.toFixed(2) },
    await existingPeriods(center.id, args.excludeRequestId),
  );
  if (args.input.invoiceNo.trim().length > MAX_INVOICE_NO) {
    blocks.push({ code: "MISSING_FIELD", message: `เลขที่ใบแจ้งหนี้ยาวเกิน ${MAX_INVOICE_NO} ตัวอักษร` });
  }

  if (blocks.length || (warnings.length && !args.confirmWarnings)) return { ok: false, blocks, warnings };
  return { ok: true };
}

async function storeFile(file: File | null): Promise<{ ok: true; saved: SavedFile | null } | { ok: false; error: string }> {
  if (!file) return { ok: true, saved: null };
  const result = await saveInvoiceFile(file);
  return result.ok ? { ok: true, saved: result.file } : result;
}

export async function createRequest(args: {
  centerId: string;
  input: RequestInput;
  file: File | null;
  confirmWarnings: boolean;
  actor: CurrentUser;
}): Promise<SaveOutcome> {
  const check = await validate({ ...args, hasExistingFile: false });
  if (!check.ok) return check;

  const stored = await storeFile(args.file);
  if (!stored.ok) return { ok: false, blocks: [], warnings: [], error: stored.error };

  try {
    const request = await db.$transaction(async (tx) => {
      const created = await tx.request.create({
        data: {
          centerId: args.centerId,
          ...toDbFields(args.input),
          invoiceFileKey: stored.saved?.key,
          invoiceFileName: stored.saved?.fileName,
          createdById: args.actor.id,
        },
      });
      await tx.approvalLog.create({
        data: { requestId: created.id, action: "CREATE", toStatus: "CREATED", actorId: args.actor.id },
      });
      return created;
    });
    return { ok: true, id: request.id };
  } catch (error) {
    if (stored.saved) await removeInvoiceFile(stored.saved.key);
    if (isOverlapViolation(error)) return { ok: false, blocks: [OVERLAP_ISSUE], warnings: [] };
    throw error;
  }
}

export async function updateRequest(args: {
  requestId: string;
  input: RequestInput;
  file: File | null;
  confirmWarnings: boolean;
  actor: CurrentUser;
}): Promise<SaveOutcome> {
  const current = await db.request.findUnique({ where: { id: args.requestId } });
  if (!current || current.deletedAt) return { ok: false, blocks: [], warnings: [], error: "ไม่พบใบเบิกนี้" };

  const allowed = checkTransition(args.actor.role, "EDIT", current.status);
  if (!allowed.ok) return { ok: false, blocks: [], warnings: [], error: allowed.reason };

  const check = await validate({
    centerId: current.centerId,
    input: args.input,
    file: args.file,
    hasExistingFile: !!current.invoiceFileKey,
    confirmWarnings: args.confirmWarnings,
    excludeRequestId: current.id,
  });
  if (!check.ok) return check;

  const stored = await storeFile(args.file);
  if (!stored.ok) return { ok: false, blocks: [], warnings: [], error: stored.error };

  try {
    await db.$transaction(async (tx) => {
      // where มี status ด้วย: ถ้ามีคนส่งบัญชีไปแล้วระหว่างนี้ จะไม่แก้ทับ
      const updated = await tx.request.updateMany({
        where: { id: current.id, status: "CREATED", deletedAt: null },
        data: {
          ...toDbFields(args.input),
          ...(stored.saved && { invoiceFileKey: stored.saved.key, invoiceFileName: stored.saved.fileName }),
        },
      });
      if (updated.count === 0) throw new StaleRequestError();
      await tx.approvalLog.create({
        data: {
          requestId: current.id,
          action: "EDIT",
          fromStatus: "CREATED",
          toStatus: "CREATED",
          actorId: args.actor.id,
          note: stored.saved ? "เปลี่ยนไฟล์ใบแจ้งหนี้" : null,
        },
      });
    });
    return { ok: true, id: current.id };
  } catch (error) {
    if (stored.saved) await removeInvoiceFile(stored.saved.key);
    if (isOverlapViolation(error)) return { ok: false, blocks: [OVERLAP_ISSUE], warnings: [] };
    if (error instanceof StaleRequestError) return { ok: false, blocks: [], warnings: [], error: STALE_MESSAGE };
    throw error;
  }
}

export type TransitionOutcome = { ok: true } | { ok: false; error: string };

// เปลี่ยนสถานะ: SEND (ส่งบัญชีแล้ว), DELETE (ลบแบบ soft), REVERT (admin ย้อนกลับ ต้องมีเหตุผล)
// PAY (บันทึกการจ่าย) จะเพิ่มในเฟส 5
export async function transitionRequest(args: {
  requestId: string;
  action: Extract<RequestAction, "SEND" | "DELETE" | "REVERT">;
  actor: CurrentUser;
  note?: string;
}): Promise<TransitionOutcome> {
  const current = await db.request.findUnique({ where: { id: args.requestId } });
  if (!current || current.deletedAt) return { ok: false, error: "ไม่พบใบเบิกนี้" };

  const allowed = checkTransition(args.actor.role, args.action, current.status);
  if (!allowed.ok) return { ok: false, error: allowed.reason };

  const note = args.note?.trim() || null;
  if (args.action === "REVERT" && !note) return { ok: false, error: "กรุณาระบุเหตุผลที่ย้อนสถานะ" };

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.request.updateMany({
        where: { id: current.id, status: current.status, deletedAt: null },
        data: args.action === "DELETE" ? { deletedAt: new Date() } : { status: allowed.to },
      });
      if (updated.count === 0) throw new StaleRequestError();
      await tx.approvalLog.create({
        data: {
          requestId: current.id,
          action: args.action,
          fromStatus: current.status,
          toStatus: allowed.to,
          actorId: args.actor.id,
          note,
        },
      });
    });
  } catch (error) {
    if (error instanceof StaleRequestError) return { ok: false, error: STALE_MESSAGE };
    throw error;
  }
  return { ok: true };
}
