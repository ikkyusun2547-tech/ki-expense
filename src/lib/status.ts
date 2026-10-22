import type { CenterStatus, LogAction, RequestStatus, Role } from "@/generated/prisma/enums";

// state machine ของใบเบิก + สิทธิ์ตามบทบาท — ใช้ทั้งฝั่งเซิร์ฟเวอร์ (บังคับ) และหน้าจอ (ซ่อนปุ่ม)
//
//   CREATE → CREATED ──SEND──▶ SENT ──PAY──▶ PAID (ล็อก)
//            ▲  EDIT/DELETE      │
//            └──────REVERT───────┘  (admin)

export type RequestAction = Exclude<LogAction, "CREATE">;

type ActionRule = {
  roles: readonly Role[];
  from: readonly RequestStatus[];
  to?: RequestStatus; // ไม่ระบุ = สถานะเดิม
};

export const ACTION_RULES: Record<RequestAction, ActionRule> = {
  EDIT: { roles: ["CREATOR"], from: ["CREATED"] },
  DELETE: { roles: ["CREATOR"], from: ["CREATED"] },
  SEND: { roles: ["CREATOR"], from: ["CREATED"], to: "SENT" },
  PAY: { roles: ["ACCOUNTING"], from: ["SENT"], to: "PAID" },
  REVERT: { roles: ["ADMIN"], from: ["SENT"], to: "CREATED" },
};

export const STATUS_LABEL: Record<RequestStatus, string> = {
  CREATED: "สร้างแล้ว",
  SENT: "ส่งบัญชีแล้ว",
  PAID: "จ่ายแล้ว",
};

export const CENTER_STATUS_LABEL: Record<CenterStatus, string> = {
  ACTIVE: "ใช้งาน",
  MOVED: "ย้าย",
  CLOSED: "ปิด",
};

export const ROLE_LABEL: Record<Role, string> = {
  CREATOR: "ผู้จัดทำ",
  ACCOUNTING: "ฝ่ายบัญชี",
  ADMIN: "ผู้ดูแลระบบ",
};

export const ACTION_LABEL: Record<LogAction, string> = {
  CREATE: "สร้างใบเบิก",
  EDIT: "แก้ไข",
  DELETE: "ลบ",
  SEND: "ส่งบัญชีแล้ว",
  PAY: "บันทึกการจ่าย",
  REVERT: "ย้อนสถานะ",
};

export function canCreateRequest(role: Role): boolean {
  return role === "CREATOR";
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
