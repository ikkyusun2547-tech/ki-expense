import { describe, expect, it } from "vitest";
import type { RequestStatus, Role } from "@/generated/prisma/enums";
import { canCreateRequest, canPerform, checkTransition, type RequestAction } from "@/lib/status";

const ROLES: Role[] = ["CREATOR", "ACCOUNTING", "ADMIN"];
const STATUSES: RequestStatus[] = ["CREATED", "SENT", "PAID"];
const ACTIONS: RequestAction[] = ["EDIT", "DELETE", "SEND", "PAY", "REVERT"];

// ตารางสิทธิ์ที่ตกลงกัน: [บทบาท, การกระทำ, สถานะปัจจุบัน] → สถานะใหม่
const ALLOWED: [Role, RequestAction, RequestStatus, RequestStatus][] = [
  ["CREATOR", "EDIT", "CREATED", "CREATED"],
  ["CREATOR", "DELETE", "CREATED", "CREATED"],
  ["CREATOR", "SEND", "CREATED", "SENT"],
  ["ACCOUNTING", "PAY", "SENT", "PAID"],
  ["ADMIN", "REVERT", "SENT", "CREATED"],
];

describe("checkTransition", () => {
  it.each(ALLOWED)("%s %s ใบ %s → %s", (role, action, from, to) => {
    expect(checkTransition(role, action, from)).toEqual({ ok: true, to });
  });

  it("ทุกกรณีที่ไม่อยู่ในตาราง ถูกปฏิเสธพร้อมเหตุผล", () => {
    for (const role of ROLES)
      for (const action of ACTIONS)
        for (const status of STATUSES) {
          const allowed = ALLOWED.some(([r, a, s]) => r === role && a === action && s === status);
          if (allowed) continue;
          const result = checkTransition(role, action, status);
          expect(result.ok, `${role} ${action} ${status}`).toBe(false);
          if (!result.ok) expect(result.reason).not.toBe("");
        }
  });

  it("ใบที่จ่ายแล้วล็อก ไม่มีใครทำอะไรได้", () => {
    for (const role of ROLES)
      for (const action of ACTIONS) expect(canPerform(role, action, "PAID")).toBe(false);
  });

  it("ผู้จัดทำบันทึกการจ่ายไม่ได้", () => {
    const result = checkTransition("CREATOR", "PAY", "SENT");
    expect(result).toEqual({ ok: false, reason: "ผู้จัดทำไม่มีสิทธิ์บันทึกการจ่าย" });
  });

  it("ผู้จัดทำแก้ใบที่ส่งบัญชีแล้วไม่ได้", () => {
    const result = checkTransition("CREATOR", "EDIT", "SENT");
    expect(result).toEqual({ ok: false, reason: 'ใบเบิกสถานะ "ส่งบัญชีแล้ว" แก้ไขไม่ได้' });
  });
});

describe("canCreateRequest", () => {
  it("เฉพาะผู้จัดทำ", () => {
    expect(ROLES.filter(canCreateRequest)).toEqual(["CREATOR"]);
  });
});
