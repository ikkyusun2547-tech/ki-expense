import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initialFormState } from "@/lib/formState";
import { todayISO } from "@/lib/thai/date";
import { recordPayment } from "@/server/actions/accounting";
import { db } from "@/server/db";
import { getCenterCards } from "@/server/services/summary";
import { form, run } from "./helpers";
import { requestFixtures } from "./requestFixtures";

const { createUsers, loginAs, center, valid, save, idFrom, status, approvedRequest, receive, receivedRequest } = requestFixtures("zz-acc-");

const pay = (id: string, paidDate: string, paymentRef: string, returnTo = "list") =>
  run(() => recordPayment(initialFormState, form({ id, paidDate, paymentRef, returnTo })));

beforeAll(createUsers);
afterAll(() => db.$disconnect());

describe("ฝ่ายบัญชีรับเอกสาร", () => {
  it("ใบที่อนุมัติแล้ว → บัญชีรับแล้ว พร้อมเวลารับ และ log", async () => {
    const c = await center();
    const id = await approvedRequest(c.id);

    await loginAs("ACCOUNTING");
    expect(await receive(id)).toEqual({ redirect: "/accounting?received=1" });

    const r = await db.request.findUniqueOrThrow({ where: { id }, include: { logs: { orderBy: { createdAt: "asc" } } } });
    expect(r.status).toBe("RECEIVED");
    expect(r.receivedAt).toBeInstanceOf(Date);
    expect(r.approvedAt).toBeInstanceOf(Date); // เวลาอนุมัติคงเดิม (พิมพ์ในใบเบิก)
    expect(r.logs.at(-1)).toMatchObject({ action: "RECEIVE", fromStatus: "APPROVED", toStatus: "RECEIVED" });
  });

  it("จากหน้ารายละเอียด → กลับไปหน้ารายละเอียด; รับซ้ำไม่ได้", async () => {
    const c = await center();
    const id = await approvedRequest(c.id);
    await loginAs("ACCOUNTING");
    expect(await receive(id, "detail")).toEqual({ redirect: `/requests/${id}` });
    expect(await receive(id)).toEqual({ result: { error: 'ใบเบิกสถานะ "บัญชีรับแล้ว" รับเอกสารไม่ได้' } });
  });

  it("ใบที่ยังไม่อนุมัติ รับเอกสารไม่ได้", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));
    await loginAs("ACCOUNTING");
    expect(await receive(id)).toEqual({ result: { error: 'ใบเบิกสถานะ "สร้างแล้ว" รับเอกสารไม่ได้' } });
  });

  it.each(["CREATOR", "APPROVER", "ADMIN"] as const)("%s รับเอกสารแทนบัญชีไม่ได้", async (role) => {
    const c = await center();
    const id = await approvedRequest(c.id);
    await loginAs(role);
    expect(await receive(id)).toEqual({ redirect: "/" });
    expect((await db.request.findUniqueOrThrow({ where: { id } })).status).toBe("APPROVED");
  });

  it("admin ย้อนสถานะใบที่บัญชีรับแล้ว → สร้างแล้ว ล้างเวลาอนุมัติ/เวลารับ", async () => {
    const c = await center();
    const id = await receivedRequest(c.id);
    await loginAs("ADMIN");
    expect(await status(id, "REVERT", "เอกสารไม่ครบ")).toEqual({ redirect: `/requests/${id}` });
    expect(await db.request.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "CREATED", approvedAt: null, receivedAt: null });
  });
});

describe("ฝ่ายบัญชีบันทึกการจ่าย", () => {
  it("ใบที่ยังไม่รับเอกสาร (อนุมัติแล้ว) จ่ายไม่ได้", async () => {
    const c = await center();
    const id = await approvedRequest(c.id);
    await loginAs("ACCOUNTING");
    expect(await pay(id, "2026-10-20", "")).toMatchObject({ result: { error: 'ใบเบิกสถานะ "อนุมัติแล้ว" บันทึกการจ่ายไม่ได้' } });
    expect((await db.request.findUniqueOrThrow({ where: { id } })).status).toBe("APPROVED");
  });

  it("ใบที่บัญชีรับแล้ว → จ่ายแล้ว พร้อมวันที่จ่าย เลขอ้างอิง และ log", async () => {
    const c = await center();
    const id = await receivedRequest(c.id);

    expect(await pay(id, "2026-10-20", " PV-001 ")).toEqual({ redirect: "/accounting?tab=pay&paid=1" });

    const r = await db.request.findUniqueOrThrow({ where: { id }, include: { logs: { orderBy: { createdAt: "asc" } } } });
    expect(r.status).toBe("PAID");
    expect(r.paidDate?.toISOString().slice(0, 10)).toBe("2026-10-20");
    expect(r.paymentRef).toBe("PV-001");
    expect(r.logs.at(-1)).toMatchObject({
      action: "PAY",
      fromStatus: "RECEIVED",
      toStatus: "PAID",
      note: "จ่ายวันที่ 20 ต.ค. 2569 เลขอ้างอิง PV-001",
    });
  });

  it("จากหน้ารายละเอียด → กลับไปหน้ารายละเอียด", async () => {
    const c = await center();
    const id = await receivedRequest(c.id);
    expect(await pay(id, "2026-10-20", "PV-002", "detail")).toEqual({ redirect: `/requests/${id}` });
  });

  it("ต้องกรอกวันที่ (เลขอ้างอิงไม่บังคับ) วันที่ห้ามเกินวันนี้ — ไม่ผ่านแล้วไม่มีอะไรเปลี่ยน", async () => {
    const c = await center();
    const id = await receivedRequest(c.id);

    expect(await pay(id, "", "")).toMatchObject({ result: { fieldErrors: { paidDate: ["กรอกวันที่จ่าย"] } } });
    expect(await pay(id, "2999-01-01", "PV")).toMatchObject({ result: { fieldErrors: { paidDate: ["วันที่จ่ายต้องไม่เกินวันนี้"] } } });
    expect((await db.request.findUniqueOrThrow({ where: { id } })).status).toBe("RECEIVED");
  });

  it("ไม่กรอกเลขอ้างอิงก็บันทึกจ่ายได้ (เก็บเป็น null, log ไม่ต่อท้ายเลขอ้างอิง)", async () => {
    const c = await center();
    const id = await receivedRequest(c.id);
    expect(await pay(id, "2026-10-20", " ")).toEqual({ redirect: "/accounting?tab=pay&paid=1" });
    expect(await db.request.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "PAID", paymentRef: null });
    const log = await db.approvalLog.findFirstOrThrow({ where: { requestId: id, action: "PAY" } });
    expect(log.note).toBe("จ่ายวันที่ 20 ต.ค. 2569");
  });

  it("ใบที่ยังไม่อนุมัติ จ่ายไม่ได้", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));
    await loginAs("ACCOUNTING");
    expect(await pay(id, "2026-10-20", "PV")).toEqual({
      result: { error: 'ใบเบิกสถานะ "สร้างแล้ว" บันทึกการจ่ายไม่ได้', fieldErrors: {}, values: { paidDate: "2026-10-20", paymentRef: "PV" } },
    });
  });

  it.each(["CREATOR", "ADMIN"] as const)("%s บันทึกการจ่ายไม่ได้", async (role) => {
    const c = await center();
    const id = await receivedRequest(c.id);
    await loginAs(role);
    expect(await pay(id, "2026-10-20", "PV")).toEqual({ redirect: "/" });
    expect((await db.request.findUniqueOrThrow({ where: { id } })).status).toBe("RECEIVED");
  });

  it("จ่ายแล้วล็อก: จ่ายซ้ำ/ย้อนสถานะ/แก้ไข/ลบ ไม่ได้", async () => {
    const c = await center();
    const id = await receivedRequest(c.id);
    await pay(id, "2026-10-20", "PV-LOCK");

    expect(await pay(id, "2026-10-21", "PV-2")).toMatchObject({ result: { error: 'ใบเบิกสถานะ "จ่ายแล้ว" บันทึกการจ่ายไม่ได้' } });
    await loginAs("ADMIN");
    expect(await status(id, "REVERT", "ลองย้อน")).toEqual({ result: { error: 'ใบเบิกสถานะ "จ่ายแล้ว" ย้อนสถานะไม่ได้' } });
    await loginAs("CREATOR");
    expect(await save({ ...valid(c.id), id })).toMatchObject({ result: { error: 'ใบเบิกสถานะ "จ่ายแล้ว" แก้ไขไม่ได้' } });
    expect(await status(id, "DELETE")).toEqual({ result: { error: 'ใบเบิกสถานะ "จ่ายแล้ว" ลบไม่ได้' } });

    const r = await db.request.findUniqueOrThrow({ where: { id } });
    expect([r.status, r.paymentRef, r.deletedAt]).toEqual(["PAID", "PV-LOCK", null]);
  });
});

describe("การ์ดศูนย์ — ใบเบิกล่าสุด (อ่านจาก DB จริง)", () => {
  const cardOf = async (centerId: string) => (await getCenterCards()).find((r) => r.center.id === centerId);

  it("ยังไม่เคยเบิก = ไม่มีใบล่าสุด; มีใบแล้ว = ใบที่รอบบริการใหม่สุดพร้อมสถานะ", async () => {
    const c = await center();
    expect((await cardOf(c.id))?.latest).toBeUndefined();
    const older = await approvedRequest(c.id, { periodStart: "2026-08-01", periodEnd: "2026-08-31", dueDate: "2026-09-15" });
    expect((await cardOf(c.id))?.latest).toMatchObject({ id: older, status: "APPROVED", periodStart: "2026-08-01" });
    await loginAs("CREATOR");
    const newer = idFrom(await save({ ...valid(c.id), confirmWarnings: "1" }));
    expect((await cardOf(c.id))?.latest).toMatchObject({ id: newer, status: "CREATED" });
  });

  it("ใบเบิกที่ถูกลบไม่นับเป็นใบล่าสุด", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));
    expect((await cardOf(c.id))?.latest?.id).toBe(id);
    await status(id, "DELETE");
    expect((await cardOf(c.id))?.latest).toBeUndefined();
  });

  it("ศูนย์ที่ย้าย/ปิด ไม่มีการ์ด", async () => {
    const moved = await center({ status: "MOVED" });
    expect(await cardOf(moved.id)).toBeUndefined();
  });

  it("วันนี้ของระบบคิดตามเวลาไทย", () => {
    expect(todayISO(new Date("2026-10-21T17:30:00Z"))).toBe("2026-10-22");
  });
});
