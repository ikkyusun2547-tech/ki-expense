import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initialFormState } from "@/lib/formState";
import { todayISO } from "@/lib/thai/date";
import { payMany, recordPayment } from "@/server/actions/accounting";
import { db } from "@/server/db";
import { getCenterSummaries } from "@/server/services/summary";
import { form, run } from "./helpers";
import { requestFixtures } from "./requestFixtures";

const { createUsers, loginAs, center, valid, save, idFrom, status, approvedRequest } = requestFixtures("zz-acc-");

const pay = (id: string, paidDate: string, paymentRef: string, returnTo = "list") =>
  run(() => recordPayment(initialFormState, form({ id, paidDate, paymentRef, returnTo })));

beforeAll(createUsers);
afterAll(() => db.$disconnect());

describe("ฝ่ายบัญชีบันทึกการจ่าย", () => {
  it("ใบที่อนุมัติแล้ว → จ่ายแล้ว พร้อมวันที่จ่าย เลขอ้างอิง และ log", async () => {
    const c = await center();
    const id = await approvedRequest(c.id);

    await loginAs("ACCOUNTING");
    expect(await pay(id, "2026-10-20", " PV-001 ")).toEqual({ redirect: "/accounting?paid=1" });

    const r = await db.request.findUniqueOrThrow({ where: { id }, include: { logs: { orderBy: { createdAt: "asc" } } } });
    expect(r.status).toBe("PAID");
    expect(r.paidDate?.toISOString().slice(0, 10)).toBe("2026-10-20");
    expect(r.paymentRef).toBe("PV-001");
    expect(r.logs.at(-1)).toMatchObject({
      action: "PAY",
      fromStatus: "APPROVED",
      toStatus: "PAID",
      note: "จ่ายวันที่ 20 ต.ค. 2569 เลขอ้างอิง PV-001",
    });
  });

  it("จากหน้ารายละเอียด → กลับไปหน้ารายละเอียด", async () => {
    const c = await center();
    const id = await approvedRequest(c.id);
    await loginAs("ACCOUNTING");
    expect(await pay(id, "2026-10-20", "PV-002", "detail")).toEqual({ redirect: `/requests/${id}` });
  });

  it("ต้องกรอกวันที่ (เลขอ้างอิงไม่บังคับ) วันที่ห้ามเกินวันนี้ — ไม่ผ่านแล้วไม่มีอะไรเปลี่ยน", async () => {
    const c = await center();
    const id = await approvedRequest(c.id);
    await loginAs("ACCOUNTING");

    expect(await pay(id, "", "")).toMatchObject({ result: { fieldErrors: { paidDate: ["กรอกวันที่จ่าย"] } } });
    expect(await pay(id, "2999-01-01", "PV")).toMatchObject({ result: { fieldErrors: { paidDate: ["วันที่จ่ายต้องไม่เกินวันนี้"] } } });
    expect((await db.request.findUniqueOrThrow({ where: { id } })).status).toBe("APPROVED");
  });

  it("ไม่กรอกเลขอ้างอิงก็บันทึกจ่ายได้ (เก็บเป็น null, log ไม่ต่อท้ายเลขอ้างอิง)", async () => {
    const c = await center();
    const id = await approvedRequest(c.id);
    await loginAs("ACCOUNTING");
    expect(await pay(id, "2026-10-20", " ")).toEqual({ redirect: "/accounting?paid=1" });
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
    const id = await approvedRequest(c.id);
    await loginAs(role);
    expect(await pay(id, "2026-10-20", "PV")).toEqual({ redirect: "/" });
    expect((await db.request.findUniqueOrThrow({ where: { id } })).status).toBe("APPROVED");
  });

  it("จ่ายแล้วล็อก: จ่ายซ้ำ/ย้อนสถานะ/แก้ไข/ลบ ไม่ได้", async () => {
    const c = await center();
    const id = await approvedRequest(c.id);
    await loginAs("ACCOUNTING");
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

describe("ตารางสรุปรายศูนย์ (อ่านจาก DB จริง)", () => {
  // วันที่ติดตาม: 22 ต.ค. 2569
  const today = "2026-10-22";
  const rowOf = async (centerId: string) => (await getCenterSummaries(today)).find((r) => r.center.id === centerId);

  it("แยกสถานะ: เลยกำหนด / ใกล้ครบ / ยังไม่ถึงรอบ / เบิกแล้ว", async () => {
    const overdue = await center({ dueDay: 15 });
    const soon = await center({ dueDay: 25 });
    const notYet = await center({ dueDay: 31 });
    const requested = await center({ dueDay: 15 });
    const id = await approvedRequest(requested.id, { dueDate: "2026-10-15" });

    expect(await rowOf(overdue.id)).toMatchObject({ state: "OVERDUE", dueDate: "2026-10-15", daysLeft: -7 });
    expect(await rowOf(soon.id)).toMatchObject({ state: "DUE_SOON", dueDate: "2026-10-25", daysLeft: 3 });
    expect(await rowOf(notYet.id)).toMatchObject({ state: "NOT_YET", dueDate: "2026-10-31", daysLeft: 9 });
    expect(await rowOf(requested.id)).toMatchObject({ state: "REQUESTED", request: { id, status: "APPROVED" } });
  });

  it("ใบเบิกที่ถูกลบไม่นับว่าเบิกแล้ว", async () => {
    const c = await center({ dueDay: 15 });
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));
    expect(await rowOf(c.id)).toMatchObject({ state: "REQUESTED" });
    await status(id, "DELETE");
    expect(await rowOf(c.id)).toMatchObject({ state: "OVERDUE" });
  });

  it("ศูนย์ที่ย้าย/ปิด ไม่อยู่ในตาราง", async () => {
    const moved = await center({ status: "MOVED" });
    expect(await rowOf(moved.id)).toBeUndefined();
  });

  it("วันนี้ของระบบคิดตามเวลาไทย", () => {
    expect(todayISO(new Date("2026-10-21T17:30:00Z"))).toBe("2026-10-22");
  });
});

describe("บันทึกจ่ายทีละหลายใบ", () => {
  const payIds = (ids: string[], paidDate: string, paymentRef: string) => {
    const fd = form({ paidDate, paymentRef });
    for (const id of ids) fd.append("ids", id);
    return run(() => payMany(initialFormState, fd));
  };

  it("วันที่ + เลขอ้างอิงเดียวกันทุกใบ; ใบที่จ่ายไปแล้วข้ามไปแล้วแจ้งจำนวน", async () => {
    const [a, b, c] = [await approvedRequest((await center()).id), await approvedRequest((await center()).id), await approvedRequest((await center()).id)];
    await loginAs("ACCOUNTING");
    await pay(c, "2026-10-19", "PV-C"); // จ่ายไปก่อนแล้ว 1 ใบ

    expect(await payIds([a, b, c, a], "2026-10-20", "PV-BULK")).toEqual({ redirect: "/accounting?paid=2&fail=1" });
    for (const id of [a, b]) {
      expect(await db.request.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "PAID", paymentRef: "PV-BULK" });
    }
    expect((await db.request.findUniqueOrThrow({ where: { id: c } })).paymentRef).toBe("PV-C");
  });

  it("ไม่เลือก / ไม่กรอกวันที่ → ไม่บันทึกอะไร; บทบาทอื่นเรียกไม่ได้", async () => {
    const id = await approvedRequest((await center()).id);
    await loginAs("ACCOUNTING");
    expect(await payIds([], "2026-10-20", "PV")).toMatchObject({ result: { error: expect.stringContaining("เลือกใบเบิก") } });
    expect(await payIds([id], "", "")).toMatchObject({ result: { fieldErrors: { paidDate: ["กรอกวันที่จ่าย"] } } });
    expect((await db.request.findUniqueOrThrow({ where: { id } })).status).toBe("APPROVED");

    await loginAs("ADMIN");
    expect(await payIds([id], "2026-10-20", "PV")).toEqual({ redirect: "/" });
  });
});
