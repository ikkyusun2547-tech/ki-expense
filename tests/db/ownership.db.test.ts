import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initialFormState } from "@/lib/formState";
import { transferRequestOwner, transferUserRequests } from "@/server/actions/requests";
import { db } from "@/server/db";
import { form, run } from "./helpers";
import { requestFixtures } from "./requestFixtures";

// แก้/ลบ/ส่งได้เฉพาะเจ้าของใบ + admin โอนใบให้ผู้จัดทำคนอื่น (ผู้ใช้เลือก 2026-10-27)
const { createUsers, loginAs, userId, center, valid, save, idFrom, status, pickSigners, pendingRequest } = requestFixtures("zz-own-");

const requestOf = (id: string) => db.request.findUniqueOrThrow({ where: { id }, include: { logs: { orderBy: { createdAt: "asc" } } } });
const transferOne = (id: string, toUserId: string) => run(() => transferRequestOwner(initialFormState, form({ id, toUserId })));
const transferAll = (fromUserId: string, toUserId: string) =>
  run(() => transferUserRequests(initialFormState, form({ fromUserId, toUserId })));
const NOT_OWNER = expect.stringContaining("เฉพาะผู้สร้างใบ");

beforeAll(createUsers);
afterAll(() => db.$disconnect());

describe("เฉพาะเจ้าของใบ", () => {
  it("ผู้จัดทำคนอื่นแก้/เลือกผู้ลงนาม/ส่ง/ลบไม่ได้ — เจ้าของทำได้", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));

    await loginAs("CREATOR2");
    expect(await save({ ...valid(c.id), id, invoiceNo: "INV-แก้" })).toMatchObject({ result: { error: NOT_OWNER } });
    expect(await pickSigners(id, "", await userId("APPROVER"))).toMatchObject({ result: { error: NOT_OWNER } });
    expect(await status(id, "SUBMIT")).toMatchObject({ result: { error: NOT_OWNER } });
    expect(await status(id, "DELETE")).toMatchObject({ result: { error: NOT_OWNER } });
    expect(await requestOf(id)).toMatchObject({ invoiceNo: "INV-001", status: "CREATED", deletedAt: null });

    await loginAs("CREATOR");
    expect(await save({ ...valid(c.id), id, invoiceNo: "INV-แก้" })).toEqual({ redirect: `/requests/${id}` });
    expect(await status(id, "DELETE")).toEqual({ redirect: "/requests" });
  });
});

describe("admin โอนใบเบิก", () => {
  it("โอนแล้วเจ้าของใหม่แก้ได้ เจ้าของเดิมแก้ไม่ได้; ผู้ขออนุมัติในใบยังเป็นเจ้าของเดิม + log", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));
    const creator2 = await userId("CREATOR2");

    await loginAs("ADMIN");
    expect(await transferOne(id, creator2)).toEqual({ redirect: `/requests/${id}?transferred=1` });
    const r = await requestOf(id);
    expect(r).toMatchObject({
      createdById: creator2,
      requesterId: await userId("CREATOR"),
      requesterName: "ทดสอบ creator",
      requesterTitle: "เจ้าหน้าที่ธุรการ",
    });
    expect(r.logs.at(-1)).toMatchObject({ action: "TRANSFER", note: "จาก ทดสอบ creator ให้ ทดสอบ creator2" });

    await loginAs("CREATOR");
    expect(await status(id, "DELETE")).toMatchObject({ result: { error: NOT_OWNER } });
    await loginAs("CREATOR2");
    expect(await save({ ...valid(c.id), id, invoiceNo: "INV-ใหม่" })).toEqual({ redirect: `/requests/${id}` });
  });

  it("ผู้ขออนุมัติที่เลือกไว้แล้วไม่เปลี่ยน; โอนให้คนเดิม/ไม่ใช่ผู้จัดทำไม่ได้; บทบาทอื่นโอนไม่ได้", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save({ ...valid(c.id), requesterId: await userId("CREATOR2") }));

    for (const role of ["CREATOR", "APPROVER", "ACCOUNTING"] as const) {
      await loginAs(role);
      expect(await transferOne(id, await userId("CREATOR2"))).toEqual({ redirect: "/" });
    }

    await loginAs("ADMIN");
    expect(await transferOne(id, await userId("CREATOR"))).toMatchObject({ result: { error: "ใบเบิกนี้เป็นของผู้จัดทำคนนี้อยู่แล้ว" } });
    expect(await transferOne(id, await userId("APPROVER"))).toMatchObject({ result: { error: "เลือกผู้จัดทำที่ใช้งานอยู่" } });
    await transferOne(id, await userId("CREATOR2"));
    expect(await requestOf(id)).toMatchObject({ createdById: await userId("CREATOR2"), requesterName: "ทดสอบ creator2" });
  });

  it("โอนทั้งหมดจากหน้าผู้ใช้ = ใบที่ยังไม่จ่าย (สร้างแล้ว/รออนุมัติ) ของคนนั้น ไม่รวมใบที่ลบ", async () => {
    const creator = await userId("CREATOR");
    const creator2 = await userId("CREATOR2");
    await loginAs("ADMIN");
    await transferAll(creator, creator2); // ล้างใบค้างจาก test ก่อนหน้า

    const c1 = await center();
    const c2 = await center();
    const c3 = await center();
    await loginAs("CREATOR");
    const draft = idFrom(await save(valid(c1.id)));
    const deleted = idFrom(await save(valid(c3.id)));
    await status(deleted, "DELETE");
    const pending = await pendingRequest(c2.id);

    await loginAs("ADMIN");
    expect(await transferAll(creator, creator2)).toEqual({ redirect: `/admin/users/${creator}?transferred=2` });
    expect((await requestOf(draft)).createdById).toBe(creator2);
    expect(await requestOf(pending)).toMatchObject({ createdById: creator2, status: "PENDING" });
    expect((await requestOf(deleted)).createdById).toBe(creator);
  });
});
