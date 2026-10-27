import { describe, expect, it } from "vitest";
import type { RequestStatus, Role } from "@/generated/prisma/enums";
import {
  canCreateRequest,
  canPerform,
  checkRequestAction,
  checkSignerChange,
  checkTransition,
  isAssignedApprover,
  isSignerRole,
  returnedBy,
  type RequestAction,
} from "@/lib/status";

const ROLES: Role[] = ["CREATOR", "ACCOUNTING", "APPROVER", "ADMIN"];
const STATUSES: RequestStatus[] = ["CREATED", "PENDING", "APPROVED", "PAID"];
const ACTIONS: RequestAction[] = ["EDIT", "DELETE", "SUBMIT", "APPROVE", "REJECT", "PAY", "REVERT", "TRANSFER"];

// ตารางสิทธิ์ที่ตกลงกัน: [บทบาท, การกระทำ, สถานะปัจจุบัน] → สถานะใหม่
// (อนุมัติในระบบ 2026-10-24: อนุมัติแล้วเข้าคิวบัญชีทันที, ผู้อนุมัติไม่อนุมัติ → กลับเป็นสร้างแล้ว)
const ALLOWED: [Role, RequestAction, RequestStatus, RequestStatus][] = [
  ["CREATOR", "EDIT", "CREATED", "CREATED"],
  ["CREATOR", "DELETE", "CREATED", "CREATED"],
  ["CREATOR", "SUBMIT", "CREATED", "PENDING"],
  ["APPROVER", "APPROVE", "PENDING", "APPROVED"],
  ["APPROVER", "REJECT", "PENDING", "CREATED"],
  ["ACCOUNTING", "PAY", "APPROVED", "PAID"],
  ["ADMIN", "REVERT", "PENDING", "CREATED"],
  ["ADMIN", "REVERT", "APPROVED", "CREATED"],
  ["ADMIN", "TRANSFER", "CREATED", "CREATED"],
  ["ADMIN", "TRANSFER", "PENDING", "PENDING"],
  ["ADMIN", "TRANSFER", "APPROVED", "APPROVED"],
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
    const result = checkTransition("CREATOR", "PAY", "APPROVED");
    expect(result).toEqual({ ok: false, reason: "ผู้จัดทำไม่มีสิทธิ์บันทึกการจ่าย" });
  });

  it("ผู้จัดทำแก้ใบที่รออนุมัติไม่ได้", () => {
    const result = checkTransition("CREATOR", "EDIT", "PENDING");
    expect(result).toEqual({ ok: false, reason: 'ใบเบิกสถานะ "รออนุมัติ" แก้ไขไม่ได้' });
  });

  it("admin อนุมัติแทนไม่ได้, ฝ่ายบัญชีจ่ายใบที่ยังไม่อนุมัติไม่ได้", () => {
    expect(canPerform("ADMIN", "APPROVE", "PENDING")).toBe(false);
    expect(canPerform("ACCOUNTING", "PAY", "PENDING")).toBe(false);
  });
});

describe("checkRequestAction", () => {
  // แก้/ลบ/ส่งได้เฉพาะเจ้าของใบ (ผู้ใช้เลือก 2026-10-27)
  const draft = { status: "CREATED" as const, createdById: "owner" };
  const owner = { id: "owner", role: "CREATOR" as const };
  const other = { id: "other", role: "CREATOR" as const };

  it.each(["EDIT", "DELETE", "SUBMIT"] as const)("%s: เจ้าของทำได้ ผู้จัดทำคนอื่นทำไม่ได้", (action) => {
    expect(checkRequestAction(owner, action, draft).ok).toBe(true);
    expect(checkRequestAction(other, action, draft)).toMatchObject({ ok: false, reason: expect.stringContaining("เฉพาะผู้สร้างใบ") });
  });

  it("สิทธิ์อื่นไม่ขึ้นกับเจ้าของใบ (admin โอน/ย้อนสถานะ, ผู้อนุมัติ)", () => {
    expect(checkRequestAction({ id: "a", role: "ADMIN" }, "TRANSFER", draft).ok).toBe(true);
    expect(checkRequestAction({ id: "a", role: "ADMIN" }, "REVERT", { ...draft, status: "PENDING" }).ok).toBe(true);
    expect(checkRequestAction({ id: "p", role: "APPROVER" }, "APPROVE", { ...draft, status: "PENDING" }).ok).toBe(true);
  });

  it("เจ้าของก็ยังติดกฎสถานะ", () => {
    expect(checkRequestAction(owner, "EDIT", { ...draft, status: "PENDING" })).toEqual({
      ok: false,
      reason: 'ใบเบิกสถานะ "รออนุมัติ" แก้ไขไม่ได้',
    });
  });
});

describe("canCreateRequest", () => {
  it("เฉพาะผู้จัดทำ", () => {
    expect(ROLES.filter(canCreateRequest)).toEqual(["CREATOR"]);
  });
});

describe("isSignerRole", () => {
  it("ผู้จัดทำและผู้อนุมัติต้องมีตำแหน่ง", () => {
    expect(ROLES.filter(isSignerRole)).toEqual(["CREATOR", "APPROVER"]);
  });
});

describe("isAssignedApprover", () => {
  it("เฉพาะผู้อนุมัติที่เลือกไว้ในใบ", () => {
    expect(isAssignedApprover("u1", { approverId: "u1" })).toBe(true);
    expect(isAssignedApprover("u2", { approverId: "u1" })).toBe(false);
    expect(isAssignedApprover("u1", { approverId: null })).toBe(false);
  });
});

describe("checkSignerChange", () => {
  // ผู้จัดทำ + admin เลือกผู้ลงนามได้เฉพาะก่อนส่งขออนุมัติ
  it.each([
    ["CREATOR", "CREATED"],
    ["ADMIN", "CREATED"],
  ] as const)("%s เปลี่ยนได้เมื่อใบ %s", (role, status) => {
    expect(checkSignerChange(role, status)).toEqual({ ok: true });
  });

  it.each([
    ["CREATOR", "PENDING"],
    ["CREATOR", "APPROVED"],
    ["ADMIN", "PAID"],
    ["ACCOUNTING", "CREATED"],
    ["APPROVER", "CREATED"],
  ] as const)("%s เปลี่ยนไม่ได้เมื่อใบ %s", (role, status) => {
    expect(checkSignerChange(role, status)).toMatchObject({ ok: false, reason: expect.any(String) });
  });
});

describe("returnedBy", () => {
  const log = (action: "CREATE" | "EDIT" | "SUBMIT" | "APPROVE" | "REJECT" | "REVERT", note?: string) => ({ action, note });

  it("ไม่อนุมัติล่าสุด → คืน log นั้น (แม้แก้ไขต่อแล้ว)", () => {
    const logs = [log("CREATE"), log("SUBMIT"), log("REJECT", "ยอดผิด"), log("EDIT")];
    expect(returnedBy("CREATED", logs)).toEqual(log("REJECT", "ยอดผิด"));
  });

  it("admin ย้อนสถานะ → ถือว่าถูกตีกลับเช่นกัน", () => {
    expect(returnedBy("CREATED", [log("CREATE"), log("SUBMIT"), log("APPROVE"), log("REVERT", "ศูนย์ผิด")])?.note).toBe("ศูนย์ผิด");
  });

  it("ส่งใหม่แล้ว / ไม่เคยถูกตีกลับ / สถานะอื่น → null", () => {
    expect(returnedBy("PENDING", [log("SUBMIT"), log("REJECT", "x"), log("SUBMIT")])).toBeNull();
    expect(returnedBy("CREATED", [log("CREATE"), log("EDIT")])).toBeNull();
    expect(returnedBy("PENDING", [log("REJECT", "x")])).toBeNull();
  });
});
