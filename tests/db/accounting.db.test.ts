import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initialFormState } from "@/lib/formState";
import { todayISO } from "@/lib/thai/date";
import { recordPayment } from "@/server/actions/accounting";
import { db } from "@/server/db";
import { getCenterSummaries } from "@/server/services/summary";
import { form, run } from "./helpers";
import { requestFixtures } from "./requestFixtures";

const { createUsers, loginAs, center, valid, save, idFrom, status, sentRequest } = requestFixtures("zz-acc-");

const pay = (id: string, paidDate: string, paymentRef: string, returnTo = "list") =>
  run(() => recordPayment(initialFormState, form({ id, paidDate, paymentRef, returnTo })));

beforeAll(createUsers);
afterAll(() => db.$disconnect());

describe("ฝ่ายบัญชีบันทึกการจ่าย", () => {
  it("ใบที่ส่งบัญชีแล้ว → จ่ายแล้ว พร้อมวันที่จ่าย เลขอ้างอิง และ log", async () => {
    const c = await center();
    const id = await sentRequest(c.id);

    await loginAs("ACCOUNTING");
    expect(await pay(id, "2026-10-20", " PV-001 ")).toEqual({ redirect: "/accounting?paid=1" });

    const r = await db.request.findUniqueOrThrow({ where: { id }, include: { logs: { orderBy: { createdAt: "asc" } } } });
    expect(r.status).toBe("PAID");
    expect(r.paidDate?.toISOString().slice(0, 10)).toBe("2026-10-20");
    expect(r.paymentRef).toBe("PV-001");
    expect(r.logs.at(-1)).toMatchObject({
      action: "PAY",
      fromStatus: "SENT",
      toStatus: "PAID",
      note: "จ่ายวันที่ 20 ต.ค. 2569 เลขอ้างอิง PV-001",
    });
  });

  it("จากหน้ารายละเอียด → กลับไปหน้ารายละเอียด", async () => {
    const c = await center();
    const id = await sentRequest(c.id);
    await loginAs("ACCOUNTING");
    expect(await pay(id, "2026-10-20", "PV-002", "detail")).toEqual({ redirect: `/requests/${id}` });
  });

  it("ต้องกรอกวันที่และเลขอ้างอิง วันที่ห้ามเกินวันนี้ — ไม่ผ่านแล้วไม่มีอะไรเปลี่ยน", async () => {
    const c = await center();
    const id = await sentRequest(c.id);
    await loginAs("ACCOUNTING");

    expect(await pay(id, "", "")).toMatchObject({
      result: { fieldErrors: { paidDate: ["กรอกวันที่จ่าย"], paymentRef: ["กรอกเลขอ้างอิงการจ่าย"] } },
    });
    expect(await pay(id, "2999-01-01", "PV")).toMatchObject({ result: { fieldErrors: { paidDate: ["วันที่จ่ายต้องไม่เกินวันนี้"] } } });
    expect((await db.request.findUniqueOrThrow({ where: { id } })).status).toBe("SENT");
  });

  it("ใบที่ยังไม่ส่งบัญชี จ่ายไม่ได้", async () => {
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
    const id = await sentRequest(c.id);
    await loginAs(role);
    expect(await pay(id, "2026-10-20", "PV")).toEqual({ redirect: "/" });
    expect((await db.request.findUniqueOrThrow({ where: { id } })).status).toBe("SENT");
  });

  it("จ่ายแล้วล็อก: จ่ายซ้ำ/ย้อนสถานะ/แก้ไข/ลบ ไม่ได้", async () => {
    const c = await center();
    const id = await sentRequest(c.id);
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
    const id = await sentRequest(requested.id, { dueDate: "2026-10-15" });

    expect(await rowOf(overdue.id)).toMatchObject({ state: "OVERDUE", dueDate: "2026-10-15", daysLeft: -7 });
    expect(await rowOf(soon.id)).toMatchObject({ state: "DUE_SOON", dueDate: "2026-10-25", daysLeft: 3 });
    expect(await rowOf(notYet.id)).toMatchObject({ state: "NOT_YET", dueDate: "2026-10-31", daysLeft: 9 });
    expect(await rowOf(requested.id)).toMatchObject({ state: "REQUESTED", request: { id, status: "SENT" } });
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
