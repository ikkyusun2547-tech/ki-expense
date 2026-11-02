import type { CenterStatus, LogAction, RequestStatus, Role, ServiceKind } from "@/generated/prisma/enums";

// state machine ของใบเบิก + สิทธิ์ตามบทบาท — ใช้ทั้งฝั่งเซิร์ฟเวอร์ (บังคับ) และหน้าจอ (ซ่อนปุ่ม)
//
//   CREATE → CREATED ──SUBMIT──▶ PENDING ──APPROVE──▶ APPROVED ──RECEIVE──▶ RECEIVED ──PAY──▶ PAID (ล็อก)
//            ▲  EDIT/DELETE         │                    │                      │
//            ├───────REJECT─────────┘ (ผู้อนุมัติ)          │                      │
//            └───────REVERT─────────┴────────────────────┴──────────────────────┘ (admin)
//
// ใบเบิกยังเป็นกระดาษเซ็นมือ — สถานะ = เอกสารอยู่ที่ใคร (documentLocation): ผู้จัดทำ → ผู้อนุมัติ → ส่งไปบัญชี → บัญชีรับแล้ว → จ่ายแล้ว
//
// APPROVE/REJECT ต้องเป็นผู้อนุมัติที่เลือกไว้ในใบนั้นเท่านั้น (ตรวจใน service ด้วย isAssignedApprover)
// EDIT/DELETE/SUBMIT เฉพาะผู้จัดทำที่สร้างใบ (OWNER_ACTIONS) — admin โอนใบให้คนอื่นได้ (TRANSFER) เมื่อเจ้าของไม่อยู่

// SEND = การกระทำเดิมก่อนมีการอนุมัติในระบบ — เหลือไว้แสดง log เก่าเท่านั้น
export type RequestAction = Exclude<LogAction, "CREATE" | "SEND">;

type ActionRule = {
  roles: readonly Role[];
  from: readonly RequestStatus[];
  to?: RequestStatus; // ไม่ระบุ = สถานะเดิม
};

export const ACTION_RULES: Record<RequestAction, ActionRule> = {
  EDIT: { roles: ["CREATOR"], from: ["CREATED"] },
  DELETE: { roles: ["CREATOR"], from: ["CREATED"] },
  SUBMIT: { roles: ["CREATOR"], from: ["CREATED"], to: "PENDING" },
  APPROVE: { roles: ["APPROVER"], from: ["PENDING"], to: "APPROVED" },
  REJECT: { roles: ["APPROVER"], from: ["PENDING"], to: "CREATED" },
  RECEIVE: { roles: ["ACCOUNTING"], from: ["APPROVED"], to: "RECEIVED" }, // ฝ่ายบัญชีได้รับกระดาษแล้ว
  PAY: { roles: ["ACCOUNTING"], from: ["RECEIVED"], to: "PAID" }, // จ่ายได้เมื่อรับเอกสารแล้วเท่านั้น
  REVERT: { roles: ["ADMIN"], from: ["PENDING", "APPROVED", "RECEIVED"], to: "CREATED" },
  TRANSFER: { roles: ["ADMIN"], from: ["CREATED", "PENDING", "APPROVED", "RECEIVED"] }, // จ่ายแล้ว = ล็อก ไม่ต้องมีเจ้าของดูแลต่อ
};

// ทำได้เฉพาะผู้จัดทำที่สร้างใบ (ผู้ใช้เลือก 2026-10-27 — จะมีผู้จัดทำหลายคน)
export const OWNER_ACTIONS: readonly RequestAction[] = ["EDIT", "DELETE", "SUBMIT"];

export const STATUS_LABEL: Record<RequestStatus, string> = {
  CREATED: "สร้างแล้ว",
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  RECEIVED: "บัญชีรับแล้ว",
  PAID: "จ่ายแล้ว",
};

export const CENTER_STATUS_LABEL: Record<CenterStatus, string> = {
  ACTIVE: "ใช้งาน",
  MOVED: "ย้าย",
  CLOSED: "ปิด",
};

export const SERVICE_KIND_LABEL: Record<ServiceKind, string> = {
  INTERNET: "อินเทอร์เน็ต",
  PHONE: "โทรศัพท์",
};

// เบอร์โทรศัพท์ไม่มีสถานะ "ย้าย" (CHECK Center_phone_status) และเรียก CLOSED ว่า "ยกเลิก"
export const PHONE_STATUS_LABEL: Record<"ACTIVE" | "CLOSED", string> = {
  ACTIVE: "ใช้งาน",
  CLOSED: "ยกเลิก",
};

export function centerStatusLabel(status: CenterStatus, kind: ServiceKind = "INTERNET"): string {
  return kind === "PHONE" && status !== "MOVED" ? PHONE_STATUS_LABEL[status] : CENTER_STATUS_LABEL[status];
}

export const ROLE_LABEL: Record<Role, string> = {
  CREATOR: "ผู้จัดทำ",
  ACCOUNTING: "ฝ่ายบัญชี",
  APPROVER: "ผู้อนุมัติ",
  ADMIN: "ผู้ดูแลระบบ",
};

export const ACTION_LABEL: Record<LogAction, string> = {
  CREATE: "สร้างใบเบิก",
  EDIT: "แก้ไข",
  DELETE: "ลบ",
  SEND: "ส่งบัญชีแล้ว",
  SUBMIT: "ส่งขออนุมัติ",
  APPROVE: "อนุมัติ",
  RECEIVE: "รับเอกสาร",
  REJECT: "ไม่อนุมัติ",
  PAY: "บันทึกการจ่าย",
  REVERT: "ย้อนสถานะ",
  TRANSFER: "โอนใบเบิก",
};

export function canCreateRequest(role: Role): boolean {
  return role === "CREATOR";
}

// บทบาทที่ต้องมีตำแหน่ง (พิมพ์ใต้ชื่อในใบเบิก) และเลือกเป็นผู้ลงนามได้
export const SIGNER_ROLES = ["CREATOR", "APPROVER"] as const satisfies readonly Role[];

export function isSignerRole(role: Role): boolean {
  return (SIGNER_ROLES as readonly Role[]).includes(role);
}

// เปลี่ยนผู้ลงนาม (ผู้ขออนุมัติ/ผู้อนุมัติ) แยกจาก EDIT เพราะ admin ทำแทนได้ — เฉพาะก่อนส่งขออนุมัติ
// (ส่งแล้วใบอยู่ในคิวของผู้อนุมัติคนนั้น ถ้าเลือกผิดให้ผู้อนุมัติกด "ไม่อนุมัติ" หรือ admin ย้อนสถานะ)
export const SIGNER_RULE: ActionRule = { roles: ["CREATOR", "ADMIN"], from: ["CREATED"] };

export function checkSignerChange(role: Role, status: RequestStatus): { ok: true } | { ok: false; reason: string } {
  if (!SIGNER_RULE.roles.includes(role)) return { ok: false, reason: `${ROLE_LABEL[role]}ไม่มีสิทธิ์เปลี่ยนผู้ลงนาม` };
  if (!SIGNER_RULE.from.includes(status)) {
    return { ok: false, reason: `ใบเบิกสถานะ "${STATUS_LABEL[status]}" เปลี่ยนผู้ลงนามไม่ได้` };
  }
  return { ok: true };
}

export type TransitionCheck =
  | { ok: true; to: RequestStatus }
  | { ok: false; reason: string };

export function checkTransition(role: Role, action: RequestAction, status: RequestStatus): TransitionCheck {
  const rule = ACTION_RULES[action];
  if (!rule.roles.includes(role)) {
    return { ok: false, reason: `${ROLE_LABEL[role]}ไม่มีสิทธิ์${ACTION_LABEL[action]}` };
  }
  if (!rule.from.includes(status)) {
    return { ok: false, reason: `ใบเบิกสถานะ "${STATUS_LABEL[status]}" ${ACTION_LABEL[action]}ไม่ได้` };
  }
  return { ok: true, to: rule.to ?? status };
}

export function canPerform(role: Role, action: RequestAction, status: RequestStatus): boolean {
  return checkTransition(role, action, status).ok;
}

export const NOT_OWNER_REASON = "ใบเบิกนี้เป็นของผู้จัดทำคนอื่น แก้ไข/ลบ/ส่งได้เฉพาะผู้สร้างใบ (ถ้าผู้สร้างไม่อยู่ ให้ผู้ดูแลระบบโอนใบให้)";

// checkTransition + เจ้าของใบ — ใช้กับใบเบิกจริง (service บังคับ, หน้าจอซ่อนปุ่ม)
export function checkRequestAction(
  actor: { id: string; role: Role },
  action: RequestAction,
  request: { status: RequestStatus; createdById: string },
): TransitionCheck {
  const result = checkTransition(actor.role, action, request.status);
  if (result.ok && OWNER_ACTIONS.includes(action) && request.createdById !== actor.id) return { ok: false, reason: NOT_OWNER_REASON };
  return result;
}

// ใบที่ "สร้างแล้ว" เพราะถูกตีกลับ (ผู้อนุมัติไม่อนุมัติ / admin ย้อนสถานะ) → คืน log นั้นไว้แสดงเหตุผลให้ผู้จัดทำเห็น
// ดูเฉพาะการกระทำที่เปลี่ยนเส้นทางอนุมัติ: ส่งใหม่หรืออนุมัติแล้ว = ไม่ใช่ใบถูกตีกลับอีกต่อไป
const ROUTE_ACTIONS: readonly LogAction[] = ["SUBMIT", "APPROVE", "REJECT", "REVERT"];

export function returnedBy<T extends { action: LogAction }>(status: RequestStatus, logs: readonly T[]): T | null {
  if (status !== "CREATED") return null;
  const last = logs.filter((l) => ROUTE_ACTIONS.includes(l.action)).at(-1);
  return last && (last.action === "REJECT" || last.action === "REVERT") ? last : null;
}

// เอกสาร (กระดาษ) อยู่ที่ใคร — แสดงในหน้าใบเบิกให้ผู้จัดทำไม่ต้องโทรถาม
export function documentLocation(request: { status: RequestStatus; approverName: string | null; createdBy: { name: string } }): string {
  switch (request.status) {
    case "CREATED":
      return `ผู้จัดทำ (${request.createdBy.name})`;
    case "PENDING":
      return `ผู้อนุมัติ (${request.approverName ?? "ยังไม่เลือก"})`;
    case "APPROVED":
      return "กำลังส่งไปฝ่ายบัญชี (บัญชียังไม่กดรับ)";
    case "RECEIVED":
      return "ฝ่ายบัญชี (รอจ่าย)";
    case "PAID":
      return "ฝ่ายบัญชี (จ่ายแล้ว)";
  }
}

// อนุมัติ/ไม่อนุมัติได้เฉพาะผู้อนุมัติที่ผู้จัดทำเลือกไว้ในใบ
export function isAssignedApprover(userId: string, request: { approverId: string | null }): boolean {
  return request.approverId !== null && request.approverId === userId;
}
