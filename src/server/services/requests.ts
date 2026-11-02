import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Role, ServiceKind } from "@/generated/prisma/enums";
import { parseAmount, toAmountString } from "@/lib/money";
import { fillMemoTexts, type MemoInput, type MemoTexts } from "@/lib/pdf/memoData";
import { checkPayment, type PaymentInput } from "@/lib/rules/paymentRules";
import { phoneCharges } from "@/lib/rules/phoneCharges";
import { checkRequest, needsConfirm, type Issue, type RequestDraft } from "@/lib/rules/requestRules";
import { checkRequestAction, checkSignerChange, checkTransition, isAssignedApprover, NOT_OWNER_REASON, type RequestAction } from "@/lib/status";
import { formatThaiDate, fromISODate, isISODate, todayISO, toISODate, type ISODate } from "@/lib/thai/date";
import type { CurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { isOverlapViolation } from "@/server/dbErrors";
import { removeInvoiceFile, saveInvoiceFile, type SavedFile } from "@/server/files";

// ตรรกะใบเบิกที่แตะ DB — ทุกการเปลี่ยนแปลงเขียน ApprovalLog ใน transaction เดียวกัน
// ผู้เรียก (Server Action) ต้อง requireRole ก่อน; ที่นี่ตรวจสิทธิ์ตาม state machine ซ้ำอีกชั้น

// ค่าโทรศัพท์: packageAmount/extraAmount (ก่อน VAT) — ยอดเบิกคิดใหม่จากสองช่องนี้ในฝั่งเซิร์ฟเวอร์ ไม่ใช้ amount ที่ส่งมา
export type RequestInput = Omit<RequestDraft, "hasFile"> & { packageAmount?: string; extraAmount?: string };

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

// ช่องที่บันทึกลง DB หลังตรวจผ่าน (ค่าโทรศัพท์: ยอดแยก + ยอดรวมที่คิดเอง)
type Checked = { ok: true; kind: ServiceKind; fields: ReturnType<typeof toDbFields> & { packageAmount?: string; extraAmount?: string } };

// ตรวจกฎ + ตรวจไฟล์ แล้วตัดสินว่าบันทึกได้หรือยัง (คำเตือนต้องได้รับการยืนยันก่อน)
async function validate(args: {
  centerId: string;
  input: RequestInput;
  file: File | null;
  hasExistingFile: boolean;
  confirmWarnings: boolean;
  excludeRequestId?: string;
}): Promise<Checked | Extract<SaveOutcome, { ok: false }>> {
  const center = await db.center.findUnique({ where: { id: args.centerId } });
  if (!center) return { ok: false, blocks: [], warnings: [], error: "ไม่พบศูนย์/เบอร์นี้ในทะเบียน" };

  let input = args.input;
  const charges = center.kind === "PHONE" ? phoneCharges(input.packageAmount ?? "", input.extraAmount ?? "") : null;
  if (center.kind === "PHONE") {
    if (!charges) {
      const message = "กรอกค่าบริการแพ็กเกจหลัก และค่าแพ็กเกจเสริม/ส่วนเกิน เป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง";
      return { ok: false, blocks: [{ code: "MISSING_FIELD", message }], warnings: [] };
    }
    input = { ...input, amount: charges.total };
  }

  const draft: RequestDraft = { ...input, hasFile: !!args.file || args.hasExistingFile };
  const { blocks, warnings } = checkRequest(
    draft,
    { status: center.status, normalAmount: center.normalAmount.toFixed(2), kind: center.kind },
    await existingPeriods(center.id, args.excludeRequestId),
  );
  if (input.invoiceNo.trim().length > MAX_INVOICE_NO) {
    blocks.push({ code: "MISSING_FIELD", message: `เลขที่ใบแจ้งหนี้ยาวเกิน ${MAX_INVOICE_NO} ตัวอักษร` });
  }

  if (blocks.length || (needsConfirm(warnings) && !args.confirmWarnings)) return { ok: false, blocks, warnings };
  const fields = { ...toDbFields(input), ...(charges && { packageAmount: charges.packageAmount, extraAmount: charges.extraAmount }) };
  return { ok: true, kind: center.kind, fields };
}

async function storeFile(file: File | null): Promise<{ ok: true; saved: SavedFile | null } | { ok: false; error: string }> {
  if (!file) return { ok: true, saved: null };
  const result = await saveInvoiceFile(file);
  return result.ok ? { ok: true, saved: result.file } : result;
}

// ผู้ลงนามที่เลือกในฟอร์มใบเบิก: undefined = ไม่เปลี่ยน, null = ค่าเริ่มต้น (ผู้ขอ = ผู้จัดทำ / ผู้อนุมัติ = ยังไม่เลือก),
// id = บัญชีที่ใช้งานอยู่และบทบาทตรง — เก็บ id + สำเนาชื่อ/ตำแหน่ง
type Snapshot = { id: string | null; name: string | null; title: string | null };

async function signerSnapshot(userId: string | null, role: Role): Promise<Snapshot | null> {
  if (!userId) return { id: null, name: null, title: null };
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.active || user.role !== role) return null;
  return { id: user.id, name: user.name, title: user.title ?? "" };
}

const approverData = (s: Snapshot) => ({ approverId: s.id, approverName: s.name, approverTitle: s.title });
const requesterData = (s: Snapshot) => ({ requesterId: s.id, requesterName: s.name, requesterTitle: s.title });

const SIGNER_NOT_FOUND = "ไม่พบผู้ลงนามที่เลือก (อาจถูกปิดบัญชี) กรุณาเลือกใหม่";

// ---------- ตัวอย่าง PDF จากข้อมูลในฟอร์ม (ยังไม่บันทึก) ----------

export type PreviewArgs = {
  actor: CurrentUser;
  centerId: string;
  requestId?: string; // แก้ไขใบเดิม → วันที่บันทึก/ผู้จัดทำของใบนั้น
  amount: string;
  packageAmount: string; // ค่าโทรศัพท์ (ก่อน VAT) — ยอดคิดจากสองช่องนี้ เหมือนตอนบันทึกจริง
  extraAmount: string;
  periodEnd: string;
  dueDate: string;
  approverId: string | null; // null = ยังไม่เลือก
  requesterId: string | null; // null = ผู้จัดทำ
  texts: MemoTexts;
};

// ข้อมูลสำหรับ buildMemo จากค่าที่กรอกในฟอร์ม — ตรวจแค่ที่ต้องใช้พิมพ์ (กฎกันซ้ำ/คำเตือนตรวจตอนบันทึกจริง)
export async function previewMemoInput(args: PreviewArgs): Promise<{ ok: true; input: MemoInput } | { ok: false; error: string }> {
  const center = await db.center.findUnique({ where: { id: args.centerId } });
  if (!center) return { ok: false, error: "ไม่พบศูนย์/เบอร์ที่เลือก" };
  const existing = args.requestId
    ? await db.request.findUnique({ where: { id: args.requestId }, select: { createdAt: true, createdById: true } })
    : null;

  const amount = center.kind === "PHONE" ? (phoneCharges(args.packageAmount, args.extraAmount)?.total ?? null) : parseAmount(args.amount);
  if (amount === null) return { ok: false, error: "กรอกยอดเงินให้ถูกต้องก่อน (ตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง)" };
  if (!isISODate(args.dueDate)) return { ok: false, error: "กรอกวันครบกำหนดชำระก่อน" };
  if (center.kind === "PHONE" && !isISODate(args.periodEnd)) return { ok: false, error: "กรอกรอบบริการก่อน (ใบค่าโทรศัพท์ใช้เดือนที่รอบบริการสิ้นสุด)" };

  const approver = await signerSnapshot(args.approverId, "APPROVER");
  const requester = await signerSnapshot(args.requesterId, "CREATOR");
  if (!approver || !requester) return { ok: false, error: SIGNER_NOT_FOUND };
  const creator = await db.user.findUniqueOrThrow({ where: { id: existing?.createdById ?? args.actor.id }, select: { name: true, title: true } });

  return {
    ok: true,
    input: {
      memoDate: todayISO(existing?.createdAt), // ใบใหม่ = วันนี้ (วันที่ที่จะบันทึก)
      kind: center.kind,
      customerCode: center.customerCode,
      provider: center.provider,
      serviceUser: center.name,
      amount,
      dueDate: args.dueDate,
      ...(isISODate(args.periodEnd) && { periodEnd: args.periodEnd }),
      creator,
      signers: {
        requester: requester.name !== null ? { name: requester.name, title: requester.title ?? "" } : null,
        approver: approver.name !== null ? { name: approver.name, title: approver.title ?? "" } : null,
      },
      texts: fillMemoTexts(args.texts, center.kind),
    },
  };
}

export async function createRequest(args: {
  centerId: string;
  input: RequestInput;
  file: File | null;
  confirmWarnings: boolean;
  approverId?: string | null;
  requesterId?: string | null;
  texts?: MemoTexts; // จาก / เรียน / เพื่อ (ไม่ส่ง/ช่องว่าง = ข้อความตามฟอร์มจริงของประเภทนั้น)
  actor: CurrentUser;
}): Promise<SaveOutcome> {
  const approver = await signerSnapshot(args.approverId ?? null, "APPROVER");
  const requester = await signerSnapshot(args.requesterId ?? null, "CREATOR");
  if (!approver || !requester) return { ok: false, blocks: [], warnings: [], error: SIGNER_NOT_FOUND };

  const check = await validate({ ...args, hasExistingFile: false });
  if (!check.ok) return check;

  const stored = await storeFile(args.file);
  if (!stored.ok) return { ok: false, blocks: [], warnings: [], error: stored.error };

  try {
    const request = await db.$transaction(async (tx) => {
      const created = await tx.request.create({
        data: {
          centerId: args.centerId,
          ...check.fields,
          invoiceFileKey: stored.saved?.key,
          invoiceFileName: stored.saved?.fileName,
          ...approverData(approver),
          ...requesterData(requester),
          ...fillMemoTexts(args.texts ?? { department: "", recipient: "", purpose: "" }, check.kind),
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
  approverId?: string | null;
  requesterId?: string | null;
  texts?: MemoTexts; // ไม่ส่ง = ไม่เปลี่ยน
  actor: CurrentUser;
}): Promise<SaveOutcome> {
  const current = await db.request.findUnique({ where: { id: args.requestId } });
  if (!current || current.deletedAt) return { ok: false, blocks: [], warnings: [], error: "ไม่พบใบเบิกนี้" };

  const allowed = checkRequestAction(args.actor, "EDIT", current);
  if (!allowed.ok) return { ok: false, blocks: [], warnings: [], error: allowed.reason };

  // เลือกคนเดิม (แม้ถูกปิดบัญชีไปแล้ว) = ไม่เปลี่ยน
  const changed = (next: string | null | undefined, now: string | null) => next !== undefined && next !== now;
  const approver = changed(args.approverId, current.approverId) ? await signerSnapshot(args.approverId ?? null, "APPROVER") : undefined;
  const requester = changed(args.requesterId, current.requesterId) ? await signerSnapshot(args.requesterId ?? null, "CREATOR") : undefined;
  if (approver === null || requester === null) return { ok: false, blocks: [], warnings: [], error: SIGNER_NOT_FOUND };
  const check = await validate({
    centerId: current.centerId,
    input: args.input,
    file: args.file,
    hasExistingFile: !!current.invoiceFileKey,
    confirmWarnings: args.confirmWarnings,
    excludeRequestId: current.id,
  });
  if (!check.ok) return check;

  const texts = args.texts && fillMemoTexts(args.texts, check.kind);
  const textsChanged = !!texts && (["department", "recipient", "purpose"] as const).some((k) => texts[k] !== current[k]);

  const stored = await storeFile(args.file);
  if (!stored.ok) return { ok: false, blocks: [], warnings: [], error: stored.error };

  try {
    await db.$transaction(async (tx) => {
      // where มี status ด้วย: ถ้ามีคนส่งขออนุมัติไปแล้วระหว่างนี้ จะไม่แก้ทับ
      const updated = await tx.request.updateMany({
        where: { id: current.id, status: "CREATED", deletedAt: null },
        data: {
          ...check.fields,
          ...(stored.saved && { invoiceFileKey: stored.saved.key, invoiceFileName: stored.saved.fileName }),
          ...(approver && approverData(approver)),
          ...(requester && requesterData(requester)),
          ...texts,
        },
      });
      if (updated.count === 0) throw new StaleRequestError();
      const notes = [
        stored.saved && "เปลี่ยนไฟล์ใบแจ้งหนี้",
        textsChanged && "แก้ข้อความ จาก/เรียน/เพื่อ",
        requester && `ผู้ขออนุมัติ: ${describeSigner(requester, "ผู้จัดทำ")}`,
        approver && `ผู้อนุมัติ: ${describeSigner(approver, "ยังไม่เลือก")}`,
      ].filter(Boolean);
      await tx.approvalLog.create({
        data: {
          requestId: current.id,
          action: "EDIT",
          fromStatus: "CREATED",
          toStatus: "CREATED",
          actorId: args.actor.id,
          note: notes.length ? notes.join(", ") : null,
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

export type TransitionAction = Extract<RequestAction, "SUBMIT" | "APPROVE" | "REJECT" | "RECEIVE" | "DELETE" | "REVERT">;

const NOTE_REQUIRED: Partial<Record<TransitionAction, string>> = {
  REJECT: "กรุณาระบุเหตุผลที่ไม่อนุมัติ",
  REVERT: "กรุณาระบุเหตุผลที่ย้อนสถานะ",
};

// เปลี่ยนสถานะ: SUBMIT (ส่งขออนุมัติ), APPROVE/REJECT (ผู้อนุมัติที่เลือกไว้ในใบ), RECEIVE (บัญชีรับเอกสาร),
// DELETE (ลบแบบ soft), REVERT (admin ย้อนกลับ)
// PAY แยกเป็น payRequest เพราะต้องรับวันที่จ่าย + เลขอ้างอิง
export async function transitionRequest(args: {
  requestId: string;
  action: TransitionAction;
  actor: CurrentUser;
  note?: string;
}): Promise<TransitionOutcome> {
  const current = await db.request.findUnique({ where: { id: args.requestId }, include: { approver: true } });
  if (!current || current.deletedAt) return { ok: false, error: "ไม่พบใบเบิกนี้" };

  const allowed = checkRequestAction(args.actor, args.action, current);
  if (!allowed.ok) return { ok: false, error: allowed.reason };

  if ((args.action === "APPROVE" || args.action === "REJECT") && !isAssignedApprover(args.actor.id, current)) {
    return { ok: false, error: "ใบเบิกนี้ไม่ได้ส่งมาให้คุณอนุมัติ" };
  }
  if (args.action === "SUBMIT") {
    if (!current.approver) return { ok: false, error: "เลือกผู้อนุมัติก่อนส่งขออนุมัติ" };
    if (!current.approver.active || current.approver.role !== "APPROVER") {
      return { ok: false, error: `${current.approver.name} ไม่ได้เป็นผู้อนุมัติที่ใช้งานอยู่แล้ว กรุณาเลือกผู้อนุมัติใหม่` };
    }
  }

  const note = args.note?.trim() || null;
  const noteMessage = NOTE_REQUIRED[args.action];
  if (noteMessage && !note) return { ok: false, error: noteMessage };

  // อนุมัติ/รับเอกสาร → บันทึกเวลา (เวลาอนุมัติพิมพ์ในใบเบิก); กลับเป็นสร้างแล้ว → ล้างเวลาเดิม
  const reset = allowed.to === "CREATED" ? null : undefined;
  const data =
    args.action === "DELETE"
      ? { deletedAt: new Date() }
      : {
          status: allowed.to,
          approvedAt: args.action === "APPROVE" ? new Date() : reset,
          receivedAt: args.action === "RECEIVE" ? new Date() : reset,
        };

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.request.updateMany({
        where: { id: current.id, status: current.status, deletedAt: null },
        data,
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

export type PayOutcome = { ok: true } | { ok: false; error?: string; fieldErrors?: { paidDate?: string; paymentRef?: string } };

// ฝ่ายบัญชีบันทึกการจ่าย: RECEIVED (รับเอกสารแล้ว) → PAID (ล็อก) — แก้ได้เฉพาะวันที่จ่ายกับเลขอ้างอิง
export async function payRequest(args: {
  requestId: string;
  input: PaymentInput;
  today: ISODate;
  actor: CurrentUser;
}): Promise<PayOutcome> {
  const current = await db.request.findUnique({ where: { id: args.requestId } });
  if (!current || current.deletedAt) return { ok: false, error: "ไม่พบใบเบิกนี้" };

  const allowed = checkTransition(args.actor.role, "PAY", current.status);
  if (!allowed.ok) return { ok: false, error: allowed.reason };

  const payment = checkPayment(args.input, args.today);
  if (!payment.ok) return { ok: false, fieldErrors: payment.errors };

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.request.updateMany({
        where: { id: current.id, status: "RECEIVED", deletedAt: null },
        data: { status: "PAID", paidDate: fromISODate(payment.paidDate), paymentRef: payment.paymentRef },
      });
      if (updated.count === 0) throw new StaleRequestError();
      await tx.approvalLog.create({
        data: {
          requestId: current.id,
          action: "PAY",
          fromStatus: "RECEIVED",
          toStatus: "PAID",
          actorId: args.actor.id,
          note: `จ่ายวันที่ ${formatThaiDate(payment.paidDate)}${payment.paymentRef ? ` เลขอ้างอิง ${payment.paymentRef}` : ""}`,
        },
      });
    });
  } catch (error) {
    if (error instanceof StaleRequestError) return { ok: false, error: STALE_MESSAGE };
    throw error;
  }
  return { ok: true };
}

// ---------- ผู้ลงนามของใบเบิก ----------

type SignerColumns = { id: string | null; name: string | null; title: string | null };

const NO_SIGNER: SignerColumns = { id: null, name: null, title: null };

// ผู้จัดทำ/admin เลือกผู้ขออนุมัติ (ผู้จัดทำคนอื่นได้) และผู้อนุมัติ ของใบที่ยังไม่ส่งขออนุมัติ
// ค่าจากช่องเลือก = id ของผู้ใช้, "" = ค่าเริ่มต้น (ผู้ขอ = ผู้จัดทำที่สร้างใบ, ผู้อนุมัติ = ยังไม่เลือก)
// เก็บ id + สำเนาชื่อ/ตำแหน่ง แล้วเขียน log
export async function setRequestSigners(args: {
  requestId: string;
  requester: string;
  approver: string;
  actor: CurrentUser;
}): Promise<TransitionOutcome> {
  const current = await db.request.findUnique({ where: { id: args.requestId } });
  if (!current || current.deletedAt) return { ok: false, error: "ไม่พบใบเบิกนี้" };

  const allowed = checkSignerChange(args.actor.role, current.status);
  if (!allowed.ok) return { ok: false, error: allowed.reason };
  if (args.actor.role === "CREATOR" && current.createdById !== args.actor.id) return { ok: false, error: NOT_OWNER_REASON };

  // เลือกคนเดิมซ้ำ = คงสำเนาเดิม (แม้บัญชีนั้นถูกปิดไปแล้ว); เลือกคนใหม่ต้องเป็นบัญชีที่ใช้งานอยู่และบทบาทตรง
  const pick = async (choice: string, role: Role, kept: SignerColumns): Promise<SignerColumns | null> => {
    if (choice === "") return NO_SIGNER;
    if (choice === kept.id) return kept;
    const user = await db.user.findUnique({ where: { id: choice } });
    if (!user || !user.active || user.role !== role) return null;
    return { id: user.id, name: user.name, title: user.title ?? "" };
  };
  const requester = await pick(args.requester, "CREATOR", {
    id: current.requesterId,
    name: current.requesterName,
    title: current.requesterTitle,
  });
  const approver = await pick(args.approver, "APPROVER", {
    id: current.approverId,
    name: current.approverName,
    title: current.approverTitle,
  });
  if (!requester || !approver) return { ok: false, error: "ไม่พบผู้ใช้ที่เลือก (อาจถูกปิดบัญชีหรือเปลี่ยนบทบาท) กรุณาโหลดหน้าใหม่" };

  const changes = [
    requester.id !== current.requesterId ? `ผู้ขออนุมัติ: ${describeSigner(requester, "ผู้จัดทำ")}` : null,
    approver.id !== current.approverId ? `ผู้อนุมัติ: ${describeSigner(approver, "ยังไม่เลือก")}` : null,
  ].filter((c) => c !== null);
  if (changes.length === 0) return { ok: true };

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.request.updateMany({
        where: { id: current.id, status: current.status, deletedAt: null },
        data: {
          requesterId: requester.id,
          requesterName: requester.name,
          requesterTitle: requester.title,
          approverId: approver.id,
          approverName: approver.name,
          approverTitle: approver.title,
        },
      });
      if (updated.count === 0) throw new StaleRequestError();
      await tx.approvalLog.create({
        data: {
          requestId: current.id,
          action: "EDIT",
          fromStatus: current.status,
          toStatus: current.status,
          actorId: args.actor.id,
          note: `เปลี่ยนผู้ลงนาม — ${changes.join(", ")}`,
        },
      });
    });
  } catch (error) {
    if (error instanceof StaleRequestError) return { ok: false, error: STALE_MESSAGE };
    throw error;
  }
  return { ok: true };
}

// admin โอนใบเบิกให้ผู้จัดทำคนอื่น (เจ้าของเดิมลา/ลาออก) — เจ้าของใหม่แก้/ลบ/ส่งได้แทน
// ผู้ขออนุมัติที่ยังเป็นค่าเริ่มต้น (= ผู้จัดทำ) ถูกบันทึกเป็นเจ้าของเดิม เพื่อให้ชื่อในใบเบิกที่พิมพ์ไปแล้วไม่เปลี่ยนตาม
export async function transferRequest(args: { requestId: string; toUserId: string; actor: CurrentUser }): Promise<TransitionOutcome> {
  const current = await db.request.findUnique({ where: { id: args.requestId }, include: { createdBy: true } });
  if (!current || current.deletedAt) return { ok: false, error: "ไม่พบใบเบิกนี้" };

  const allowed = checkTransition(args.actor.role, "TRANSFER", current.status);
  if (!allowed.ok) return { ok: false, error: allowed.reason };
  if (current.createdById === args.toUserId) return { ok: false, error: "ใบเบิกนี้เป็นของผู้จัดทำคนนี้อยู่แล้ว" };

  const target = await db.user.findUnique({ where: { id: args.toUserId } });
  if (!target || !target.active || target.role !== "CREATOR") return { ok: false, error: "เลือกผู้จัดทำที่ใช้งานอยู่" };

  const from = current.createdBy;
  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.request.updateMany({
        where: { id: current.id, status: current.status, createdById: from.id, deletedAt: null },
        data: {
          createdById: target.id,
          ...(current.requesterId === null && requesterData({ id: from.id, name: from.name, title: from.title ?? "" })),
        },
      });
      if (updated.count === 0) throw new StaleRequestError();
      await tx.approvalLog.create({
        data: {
          requestId: current.id,
          action: "TRANSFER",
          fromStatus: current.status,
          toStatus: current.status,
          actorId: args.actor.id,
          note: `จาก ${from.name} ให้ ${target.name}`,
        },
      });
    });
  } catch (error) {
    if (error instanceof StaleRequestError) return { ok: false, error: STALE_MESSAGE };
    throw error;
  }
  return { ok: true };
}

// ใบที่ยังไม่จ่ายของผู้จัดทำคนหนึ่ง (โอนทั้งหมดได้จากหน้าแก้ไขผู้ใช้)
export const openRequestsWhere = (userId: string): Prisma.RequestWhereInput => ({
  createdById: userId,
  deletedAt: null,
  status: { in: ["CREATED", "PENDING", "APPROVED", "RECEIVED"] },
});

export async function transferOpenRequests(args: { fromUserId: string; toUserId: string; actor: CurrentUser }) {
  const requests = await db.request.findMany({ where: openRequestsWhere(args.fromUserId), select: { id: true } });
  let ok = 0;
  let error: string | undefined;
  for (const r of requests) {
    const outcome = await transferRequest({ requestId: r.id, toUserId: args.toUserId, actor: args.actor });
    if (outcome.ok) ok++;
    else error ??= outcome.error;
  }
  return { ok, failed: requests.length - ok, error };
}

function describeSigner(s: SignerColumns, fallback: string): string {
  return s.name === null ? fallback : `${s.name} (${s.title})`;
}
