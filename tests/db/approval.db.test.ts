import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getRequestPdf } from "@/app/api/requests/[id]/pdf/route";
import { initialFormState } from "@/lib/formState";
import { approveMany, findCenterByCode } from "@/server/actions/requests";
import { db } from "@/server/db";
import { run } from "./helpers";
import { requestFixtures } from "./requestFixtures";

// อนุมัติในระบบ (2026-10-24): สร้างแล้ว → ส่งขออนุมัติ → ผู้อนุมัติที่เลือกไว้อนุมัติ (เข้าคิวบัญชี) / ไม่อนุมัติ (กลับไปแก้)
const { createUsers, loginAs, userId, center, valid, save, idFrom, status, pickSigners, pendingRequest } = requestFixtures("zz-apv-");

const requestOf = (id: string) => db.request.findUniqueOrThrow({ where: { id }, include: { logs: { orderBy: { createdAt: "asc" } } } });

beforeAll(createUsers);
afterAll(() => db.$disconnect());

describe("เลือกผู้ลงนามจากบัญชีผู้ใช้", () => {
  it("เลือกผู้อนุมัติ → เก็บ id + สำเนาชื่อ/ตำแหน่ง และเขียน log; เลือกซ้ำไม่เขียน log", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));
    const approverId = await userId("APPROVER");

    expect(await pickSigners(id, "", approverId)).toEqual({ redirect: `/requests/${id}?signers=1` });
    const r = await requestOf(id);
    expect(r).toMatchObject({
      requesterId: null,
      requesterName: null,
      approverId,
      approverName: "ทดสอบ approver",
      approverTitle: "ผู้จัดการส่วน",
    });
    expect(r.logs.at(-1)?.note).toBe("เปลี่ยนผู้ลงนาม — ผู้อนุมัติ: ทดสอบ approver (ผู้จัดการส่วน)");

    await pickSigners(id, "", approverId);
    expect((await requestOf(id)).logs).toHaveLength(r.logs.length);
  });

  it("ผู้ขออนุมัติเลือกผู้จัดทำคนอื่นได้ แต่ต้องเป็นบทบาทตรงและบัญชีใช้งานอยู่", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));

    expect(await pickSigners(id, await userId("CREATOR2"), "")).toEqual({ redirect: `/requests/${id}?signers=1` });
    expect(await requestOf(id)).toMatchObject({ requesterName: "ทดสอบ creator2", requesterTitle: "เจ้าหน้าที่ GPS" });

    // ใส่ผู้อนุมัติในช่องผู้ขอ / ผู้จัดทำในช่องผู้อนุมัติ ไม่ได้
    expect(await pickSigners(id, await userId("APPROVER"), "")).toMatchObject({ result: { error: expect.stringContaining("ไม่พบผู้ใช้") } });
    expect(await pickSigners(id, "", await userId("CREATOR"))).toMatchObject({ result: { error: expect.stringContaining("ไม่พบผู้ใช้") } });
  });

  it("ฝ่ายบัญชี/ผู้อนุมัติเลือกผู้ลงนามไม่ได้; ส่งขออนุมัติแล้วเปลี่ยนไม่ได้", async () => {
    const c = await center();
    const id = await pendingRequest(c.id);

    await loginAs("CREATOR");
    expect(await pickSigners(id, "", await userId("APPROVER2"))).toMatchObject({
      result: { error: 'ใบเบิกสถานะ "รออนุมัติ" เปลี่ยนผู้ลงนามไม่ได้' },
    });
    for (const role of ["ACCOUNTING", "APPROVER"] as const) {
      await loginAs(role);
      expect(await pickSigners(id, "", "")).toEqual({ redirect: "/" });
    }
  });
});

describe("ฟอร์มใบเบิก: เลือกผู้อนุมัติ + สร้างและส่งขออนุมัติในครั้งเดียว", () => {
  it("กรอกให้ล่วงหน้าจากใบล่าสุดของศูนย์ (รอบถัดไป ยอดปกติ)", async () => {
    const c = await center();
    await loginAs("CREATOR");
    idFrom(await save(valid(c.id))); // รอบ 1–30 ก.ย. ครบกำหนด 15 ต.ค.
    expect(await findCenterByCode(c.customerCode)).toMatchObject({
      ok: true,
      suggestion: { amount: "749.00", periodStart: "2026-10-01", periodEnd: "2026-10-31", dueDate: "2026-11-15" },
    });
  });

  it("สร้างและส่งขออนุมัติ → รออนุมัติทันที แล้วกลับหน้าสรุปรายศูนย์", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const approverId = await userId("APPROVER");
    const result = await save({ ...valid(c.id), approverId, intent: "submit" });
    expect(result).toMatchObject({ redirect: expect.stringMatching(/^\/summary\?kind=INTERNET&sent=/) });

    const id = (result as { redirect: string }).redirect.split("sent=")[1];
    const r = await requestOf(id);
    expect(r).toMatchObject({ status: "PENDING", approverId, approverName: "ทดสอบ approver", approverTitle: "ผู้จัดการส่วน" });
    expect(r.logs.map((l) => l.action)).toEqual(["CREATE", "SUBMIT"]);
  });

  it("ส่งขออนุมัติโดยไม่เลือกผู้อนุมัติไม่ได้ (ไม่บันทึกอะไร); บันทึกไว้ก่อนได้", async () => {
    const c = await center();
    await loginAs("CREATOR");
    expect(await save({ ...valid(c.id), approverId: "", intent: "submit" })).toEqual({ result: { error: "เลือกผู้อนุมัติก่อนส่งขออนุมัติ" } });
    expect(await db.request.count({ where: { centerId: c.id } })).toBe(0);

    const id = idFrom(await save({ ...valid(c.id), approverId: "", intent: "save" }));
    expect(await requestOf(id)).toMatchObject({ status: "CREATED", approverId: null });
  });

  it("เลือกผู้ใช้ที่ไม่ใช่ผู้อนุมัติไม่ได้", async () => {
    const c = await center();
    await loginAs("CREATOR");
    expect(await save({ ...valid(c.id), approverId: await userId("CREATOR2"), intent: "submit" })).toMatchObject({
      result: { error: expect.stringContaining("ไม่พบผู้ลงนาม") },
    });
  });

  it("เลือกผู้ขออนุมัติในฟอร์มได้ (ผู้จัดทำคนอื่น); กลับเป็นค่าเริ่มต้นได้; เลือกผู้อนุมัติในช่องผู้ขอไม่ได้", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save({ ...valid(c.id), requesterId: await userId("CREATOR2"), intent: "save" }));
    expect(await requestOf(id)).toMatchObject({ requesterName: "ทดสอบ creator2", requesterTitle: "เจ้าหน้าที่ GPS" });

    idFrom(await save({ ...valid(c.id), id, requesterId: "", intent: "save" }, null));
    const r = await requestOf(id);
    expect(r).toMatchObject({ requesterId: null, requesterName: null });
    expect(r.logs.at(-1)?.note).toBe("ผู้ขออนุมัติ: ผู้จัดทำ");

    expect(await save({ ...valid(c.id), id, requesterId: await userId("APPROVER"), intent: "save" }, null)).toMatchObject({
      result: { error: expect.stringContaining("ไม่พบผู้ลงนาม") },
    });
  });

  it("ข้อความ จาก/เรียน/เพื่อ เป็นของแต่ละใบ: ไม่ส่ง = ตามฟอร์มจริง, ส่งมา = เก็บกับใบนั้น, เว้นว่าง = ตามฟอร์มจริง", async () => {
    await loginAs("CREATOR");
    const a = idFrom(await save({ ...valid((await center()).id), intent: "save" }));
    expect(await requestOf(a)).toMatchObject({ department: "ฝ่ายจัดหาวัตถุดิบ", purpose: "โปรดพิจารณา" });

    const b = idFrom(
      await save({ ...valid((await center()).id), department: " ฝ่ายบัญชี ", recipient: "ผู้จัดการ", purpose: "", intent: "save" }),
    );
    expect(await requestOf(b)).toMatchObject({ department: "ฝ่ายบัญชี", recipient: "ผู้จัดการ", purpose: "โปรดพิจารณา" });
    expect((await requestOf(a)).department).toBe("ฝ่ายจัดหาวัตถุดิบ"); // ใบอื่นไม่เปลี่ยน

    // แก้ข้อความ → log บอก; แก้โดยไม่ส่งช่องข้อความ = คงเดิม
    const cB = (await requestOf(b)).centerId;
    idFrom(await save({ ...valid(cB), id: b, department: "ฝ่ายใหม่", recipient: "ผู้จัดการ", purpose: "โปรดพิจารณา", intent: "save" }, null));
    expect((await requestOf(b)).logs.at(-1)?.note).toBe("แก้ข้อความ จาก/เรียน/เพื่อ");
    idFrom(await save({ ...valid(cB, { invoiceNo: "INV-9" }), id: b, intent: "save" }, null));
    expect((await requestOf(b)).department).toBe("ฝ่ายใหม่");
  });

  it("แก้ไขเปลี่ยนผู้อนุมัติ → log บอกคนใหม่; ไม่ส่งช่องผู้อนุมัติ = คงเดิม", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save({ ...valid(c.id), approverId: await userId("APPROVER"), intent: "save" }));

    idFrom(await save({ ...valid(c.id), id, approverId: await userId("APPROVER2"), intent: "save" }, null));
    const r = await requestOf(id);
    expect(r.approverName).toBe("ทดสอบ approver2");
    expect(r.logs.at(-1)?.note).toBe("ผู้อนุมัติ: ทดสอบ approver2 (รักษาการผู้จัดการส่วน)");

    idFrom(await save({ ...valid(c.id, { invoiceNo: "INV-2" }), id }, null));
    expect((await requestOf(id)).approverName).toBe("ทดสอบ approver2");
  });
});

describe("ส่งขออนุมัติ / อนุมัติ / ไม่อนุมัติ", () => {
  it("ยังไม่เลือกผู้อนุมัติ → ส่งขออนุมัติไม่ได้", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));
    expect(await status(id, "SUBMIT")).toEqual({ result: { error: "เลือกผู้อนุมัติก่อนส่งขออนุมัติ" } });
    expect((await requestOf(id)).status).toBe("CREATED");
  });

  it("ผู้อนุมัติที่ถูกปิดบัญชีระหว่างนั้น → ส่งขออนุมัติไม่ได้", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));
    const approver2 = await userId("APPROVER2");
    await pickSigners(id, "", approver2);
    await db.user.update({ where: { id: approver2 }, data: { active: false } });
    try {
      expect(await status(id, "SUBMIT")).toMatchObject({ result: { error: expect.stringContaining("ไม่ได้เป็นผู้อนุมัติที่ใช้งานอยู่") } });
    } finally {
      await db.user.update({ where: { id: approver2 }, data: { active: true } });
    }
  });

  it("เฉพาะผู้อนุมัติที่เลือกไว้กดอนุมัติได้ → อนุมัติแล้ว + เวลาอนุมัติ + log; admin อนุมัติแทนไม่ได้", async () => {
    const c = await center();
    const id = await pendingRequest(c.id);

    await loginAs("APPROVER2");
    expect(await status(id, "APPROVE")).toEqual({ result: { error: "ใบเบิกนี้ไม่ได้ส่งมาให้คุณอนุมัติ" } });
    await loginAs("ADMIN");
    expect(await status(id, "APPROVE")).toEqual({ result: { error: "ผู้ดูแลระบบไม่มีสิทธิ์อนุมัติ" } });
    expect((await requestOf(id)).status).toBe("PENDING");

    await loginAs("APPROVER");
    expect(await status(id, "APPROVE")).toEqual({ redirect: "/approvals?done=approve" });
    const r = await requestOf(id);
    expect(r.status).toBe("APPROVED");
    expect(r.approvedAt).not.toBeNull();
    expect(r.logs.at(-1)).toMatchObject({ action: "APPROVE", fromStatus: "PENDING", toStatus: "APPROVED", actorId: await userId("APPROVER") });

    // PDF พิมพ์ได้หลังอนุมัติ
    const res = await getRequestPdf(new Request("http://x"), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
  });

  it("ไม่อนุมัติต้องมีเหตุผล → กลับเป็นสร้างแล้ว ผู้จัดทำแก้แล้วส่งใหม่ได้", async () => {
    const c = await center();
    const id = await pendingRequest(c.id);

    await loginAs("APPROVER");
    expect(await status(id, "REJECT", " ")).toEqual({ result: { error: "กรุณาระบุเหตุผลที่ไม่อนุมัติ" } });
    expect(await status(id, "REJECT", "ยอดไม่ตรงใบแจ้งหนี้")).toEqual({ redirect: "/approvals?done=reject" });
    expect(await requestOf(id)).toMatchObject({ status: "CREATED", approvedAt: null });

    await loginAs("CREATOR");
    idFrom(await save({ ...valid(c.id, { amount: "750" }), id, confirmWarnings: "1" }));
    expect(await status(id, "SUBMIT")).toEqual({ redirect: `/requests/${id}` });

    const r = await requestOf(id);
    expect(r.status).toBe("PENDING");
    expect(r.logs.map((l) => [l.action, l.note?.startsWith("เปลี่ยน") ? "…" : l.note])).toEqual([
      ["CREATE", null],
      ["EDIT", "…"],
      ["SUBMIT", null],
      ["REJECT", "ยอดไม่ตรงใบแจ้งหนี้"],
      ["EDIT", "…"], // เปลี่ยนไฟล์ใบแจ้งหนี้
      ["SUBMIT", null],
    ]);
  });

  it("admin ย้อนใบที่อนุมัติแล้ว → กลับเป็นสร้างแล้ว และล้างเวลาอนุมัติ", async () => {
    const c = await center();
    const id = await pendingRequest(c.id);
    await loginAs("APPROVER");
    await status(id, "APPROVE");

    await loginAs("ADMIN");
    expect(await status(id, "REVERT", "เลือกศูนย์ผิด")).toEqual({ redirect: `/requests/${id}` });
    expect(await requestOf(id)).toMatchObject({ status: "CREATED", approvedAt: null });
  });
});

describe("อนุมัติทีละหลายใบ", () => {
  const approveIds = (ids: string[]) => {
    const fd = new FormData();
    for (const id of ids) fd.append("ids", id);
    return run(() => approveMany(initialFormState, fd));
  };

  it("อนุมัติเฉพาะใบที่ส่งมาให้ตัวเอง ใบอื่นข้ามแล้วแจ้งจำนวน", async () => {
    const mine1 = await pendingRequest((await center()).id);
    const mine2 = await pendingRequest((await center()).id);
    // ใบของผู้อนุมัติอีกคน
    await loginAs("CREATOR");
    const other = idFrom(await save(valid((await center()).id)));
    await pickSigners(other, "", await userId("APPROVER2"));
    await status(other, "SUBMIT");

    await loginAs("APPROVER");
    expect(await approveIds([mine1, mine2, other])).toEqual({ redirect: "/approvals?done=approve&n=2&fail=1" });
    expect((await requestOf(mine1)).status).toBe("APPROVED");
    expect((await requestOf(mine2)).status).toBe("APPROVED");
    expect((await requestOf(other)).status).toBe("PENDING");
  });

  it("ไม่เลือกเลย → แจ้งให้เลือก; ผู้จัดทำเรียกไม่ได้", async () => {
    await loginAs("APPROVER");
    expect(await approveIds([])).toEqual({ result: { error: "เลือกใบเบิกที่จะอนุมัติก่อน" } });
    await loginAs("CREATOR");
    expect(await approveIds(["x"])).toEqual({ redirect: "/" });
  });
});
