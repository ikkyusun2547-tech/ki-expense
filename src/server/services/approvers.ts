import "server-only";
import type { Role, ServiceKind } from "@/generated/prisma/enums";
import { DEFAULT_MEMO_TEXTS_BY_KIND, type MemoTexts } from "@/lib/pdf/memoData";
import { db } from "@/server/db";

export type ApproverOption = { id: string; name: string; title: string };

// ผู้ลงนามที่เลือกได้ในฟอร์มใบเบิก = บัญชีที่ใช้งานอยู่ของบทบาทนั้น (ผู้อนุมัติ / ผู้จัดทำสำหรับช่องผู้ขออนุมัติ)
// keep = คนที่ใบนี้เลือกไว้เดิม (แสดงต่อแม้บัญชีถูกปิดไปแล้ว)
export async function signerOptions(role: Extract<Role, "APPROVER" | "CREATOR">, keep?: ApproverOption | null): Promise<ApproverOption[]> {
  const users = await db.user.findMany({
    where: { role, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, title: true },
  });
  const options = users.map((u) => ({ id: u.id, name: u.name, title: u.title ?? "" }));
  if (keep && !options.some((o) => o.id === keep.id)) options.push({ ...keep, name: `${keep.name} (ปิดบัญชีแล้ว)` });
  return options;
}

// ผู้อนุมัติของใบเบิกล่าสุดที่ผู้จัดทำคนนี้สร้าง — ใช้เป็นค่าเริ่มต้นของใบใหม่ (ถ้ายังเลือกได้อยู่)
export async function lastApproverId(creatorId: string, options: ApproverOption[]): Promise<string> {
  const last = await db.request.findFirst({
    where: { createdById: creatorId, approverId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { approverId: true },
  });
  const id = last?.approverId ?? "";
  if (options.some((o) => o.id === id)) return id;
  return options.length === 1 ? options[0].id : "";
}

// จาก / เรียน / เพื่อ ของใบล่าสุดประเภทนี้ที่ผู้จัดทำคนนี้สร้าง (ยังไม่เคยสร้าง = ข้อความตามฟอร์มจริงของประเภทนั้น)
async function lastMemoTexts(creatorId: string, kind: ServiceKind): Promise<MemoTexts> {
  const last = await db.request.findFirst({
    where: { createdById: creatorId, center: { kind } },
    orderBy: { createdAt: "desc" },
    select: { department: true, recipient: true, purpose: true },
  });
  return last ?? DEFAULT_MEMO_TEXTS_BY_KIND[kind];
}

export type MemoTextsByKind = Record<ServiceKind, MemoTexts>;

// ค่าช่องผู้ลงนาม + ข้อความหัวบันทึกของฟอร์มใบเบิก
// (สร้าง: ผู้จัดทำ = ผู้ใช้ปัจจุบัน, ผู้อนุมัติ/ข้อความตามใบล่าสุด / แก้ไข: ตามที่ใบนี้เลือกไว้)
// texts แยกตามประเภท เพราะตอนเปิดฟอร์มสร้างยังไม่รู้ว่าจะเป็นศูนย์หรือเบอร์ (แก้ไข: ทั้งสองค่า = ข้อความของใบนี้)
export async function signerFormProps(
  creator: { id: string; name: string; title: string | null },
  current?: {
    approverId: string | null;
    approverName: string | null;
    approverTitle: string | null;
    requesterId: string | null;
    requesterName: string | null;
    requesterTitle: string | null;
  } & MemoTexts,
) {
  const keep = (id: string | null, name: string | null, title: string | null) => (id ? { id, name: name ?? "", title: title ?? "" } : null);
  const approvers = await signerOptions("APPROVER", current && keep(current.approverId, current.approverName, current.approverTitle));
  const requesters = await signerOptions("CREATOR", current && keep(current.requesterId, current.requesterName, current.requesterTitle));
  return {
    approvers,
    approverId: current ? (current.approverId ?? "") : await lastApproverId(creator.id, approvers),
    requesters,
    requesterId: current?.requesterId ?? "",
    defaultRequester: { id: creator.id, name: creator.name, title: creator.title ?? "" },
    texts: await memoTextsByKind(creator.id, current),
  };
}

async function memoTextsByKind(creatorId: string, current?: MemoTexts): Promise<MemoTextsByKind> {
  if (current) {
    const own = { department: current.department, recipient: current.recipient, purpose: current.purpose };
    return { INTERNET: own, PHONE: own };
  }
  const [INTERNET, PHONE] = await Promise.all([lastMemoTexts(creatorId, "INTERNET"), lastMemoTexts(creatorId, "PHONE")]);
  return { INTERNET, PHONE };
}
