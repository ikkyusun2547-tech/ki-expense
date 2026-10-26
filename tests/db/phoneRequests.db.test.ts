import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_MEMO_TEXTS, DEFAULT_MEMO_TEXTS_BY_KIND } from "@/lib/pdf/memoData";
import { db } from "@/server/db";
import { signerFormProps } from "@/server/services/approvers";
import { requestFixtures } from "./requestFixtures";

// ใบเบิกค่าโทรศัพท์ = ใบเบิกปกติที่ centerId ชี้ไปที่เบอร์ (Center kind = PHONE) — ใช้กฎ/ขั้นตอนเดียวกับค่าอินเทอร์เน็ต
const f = requestFixtures("zz-phreq-");
let seq = 0;

// ช่วงเบอร์ของไฟล์นี้ (DB ทดสอบล้างใหม่ทุกครั้งที่รัน แต่ใบเบิกลบไม่ได้ จึงไม่ใช้ช่วงเดียวกับ phones.db.test)
const phoneLine = (status: "ACTIVE" | "CLOSED" = "ACTIVE") =>
  db.center.create({
    data: {
      kind: "PHONE",
      customerCode: `0991${String(Date.now()).slice(-3)}${String(++seq).padStart(3, "0")}`,
      provider: "TRUE",
      name: "รัฐกิจสัมพันธ์",
      normalAmount: "374.50",
      dueDay: 9,
      status,
    },
  });

// ยอดแยกตามบิล (ก่อน VAT) — ใบเบิกค่าโทรศัพท์ต้องมีเสมอ
const BILL = { packageAmount: "350", extraAmount: "0" };
const valid = (centerId: string, extra: Record<string, string> = {}) => f.valid(centerId, { ...BILL, ...extra });

beforeAll(() => f.createUsers());

describe("ใบเบิกค่าโทรศัพท์", () => {
  it("สร้างได้ด้วยฟอร์มเดิม; ช่องข้อความว่าง = ข้อความตามฟอร์มค่าโทรศัพท์", async () => {
    const line = await phoneLine();
    await f.loginAs("CREATOR");
    const id = f.idFrom(
      await f.save({
        ...valid(line.id, { amount: "1.00", extraAmount: "31.68" }), // amount ที่ส่งมาไม่ใช้ — เซิร์ฟเวอร์คิดจากยอดแยก
        department: "",
        recipient: "",
        purpose: "",
        confirmWarnings: "1",
      }),
    );

    const saved = await db.request.findUniqueOrThrow({ where: { id }, include: { center: true } });
    expect(saved.center.kind).toBe("PHONE");
    expect(saved.amount.toFixed(2)).toBe("408.40"); // (350 + 31.68) + VAT 26.72
    expect([saved.packageAmount?.toFixed(2), saved.extraAmount?.toFixed(2)]).toEqual(["350.00", "31.68"]);
    expect({ department: saved.department, recipient: saved.recipient, purpose: saved.purpose }).toEqual(DEFAULT_MEMO_TEXTS_BY_KIND.PHONE);
  });

  it("เบอร์เดียวกัน รอบทับกัน → บล็อก (ข้อความใช้คำว่า เบอร์)", async () => {
    const line = await phoneLine();
    await f.loginAs("CREATOR");
    f.idFrom(await f.save({ ...valid(line.id), confirmWarnings: "1" }));

    const again = await f.save({
      ...valid(line.id, { invoiceNo: "INV-002", periodStart: "2026-09-15", periodEnd: "2026-10-14" }),
      confirmWarnings: "1",
    });
    expect(again).toMatchObject({
      result: { blocks: [{ code: "PERIOD_OVERLAP", message: expect.stringMatching(/^เบอร์นี้มีใบเบิกรอบ/) }] },
    });
  });

  it("ไม่กรอกยอดแยก / รูปแบบผิด → บล็อก", async () => {
    const line = await phoneLine();
    await f.loginAs("CREATOR");
    const bads: Record<string, string>[] = [{}, { packageAmount: "abc", extraAmount: "0" }, { packageAmount: "350", extraAmount: "-5" }];
    for (const bad of bads) {
      const result = await f.save({ ...f.valid(line.id), ...bad, confirmWarnings: "1" });
      expect(result).toMatchObject({ result: { blocks: [{ code: "MISSING_FIELD", message: expect.stringContaining("แพ็กเกจหลัก") }] } });
    }
  });

  it("ใบเบิกค่าอินเทอร์เน็ตไม่สนใจช่องยอดแยก (เก็บเป็น null)", async () => {
    const c = await f.center();
    await f.loginAs("CREATOR");
    const id = f.idFrom(await f.save({ ...f.valid(c.id), packageAmount: "350", extraAmount: "5", confirmWarnings: "1" }));
    const saved = await db.request.findUniqueOrThrow({ where: { id } });
    expect([saved.amount.toFixed(2), saved.packageAmount, saved.extraAmount]).toEqual(["749.00", null, null]);
  });

  it("เบอร์ที่ยกเลิกแล้ว เบิกไม่ได้", async () => {
    const line = await phoneLine("CLOSED");
    await f.loginAs("CREATOR");
    const result = await f.save({ ...valid(line.id), confirmWarnings: "1" });
    expect(result).toMatchObject({ result: { blocks: [{ code: "CENTER_INACTIVE", message: 'เบอร์สถานะ "ยกเลิก" เบิกไม่ได้' }] } });
  });

  it("ส่งขออนุมัติ → อนุมัติ → เข้าคิวบัญชี เหมือนค่าอินเทอร์เน็ต", async () => {
    const line = await phoneLine();
    const id = await f.approvedRequest(line.id, BILL);
    expect((await db.request.findUniqueOrThrow({ where: { id } })).status).toBe("APPROVED");
  });

  it("ฟอร์มสร้างใหม่จำข้อความล่าสุดแยกตามประเภท", async () => {
    const line = await phoneLine();
    await f.loginAs("CREATOR2");
    const texts = { department: "ฝ่ายรัฐกิจฯ (แก้เอง)", recipient: "ผู้จัดการฝ่ายบัญชี", purpose: "โปรดพิจารณาดำเนินการ" };
    f.idFrom(await f.save({ ...valid(line.id), ...texts, confirmWarnings: "1" }));

    const creator = await db.user.findUniqueOrThrow({ where: { id: await f.userId("CREATOR2") } });
    const props = await signerFormProps(creator);
    expect(props.texts.PHONE).toEqual(texts);
    expect(props.texts.INTERNET).toEqual(DEFAULT_MEMO_TEXTS); // ยังไม่เคยเบิกค่าอินเทอร์เน็ต
  });
});
