import { describe, expect, it } from "vitest";
import { buildMemo, chosenSignersOf, DEFAULT_MEMO_SETTINGS, resolveSigners } from "@/lib/pdf/memoData";

// ตัวอย่างจากฟอร์มจริง: บันทึกภายใน 16 ต.ค. 2569 ห้องรับรองคุณมั่นคง 749.00 ครบกำหนด 12/11/2569
const settings = {
  ...DEFAULT_MEMO_SETTINGS,
  department: "ฝ่ายรัฐกิจสัมพันธ์และหลักทรัพย์",
  requesterTitle: "เจ้าหน้าที่รัฐกิจสัมพันธ์",
};

const approver = { name: "นายทดสอบ อนุมัติ", title: "รักษาการผู้จัดการส่วนรัฐกิจและหลักทรัพย์" };

const base = {
  memoDate: "2026-10-16",
  customerCode: "600197730",
  serviceUser: "ห้องรับรองคุณมั่นคง",
  amount: "749",
  dueDate: "2026-11-12",
  creator: { name: "นางสาวทดสอบ จัดทำ", title: null },
  signers: { requester: null, approver },
  settings,
};

const memo = buildMemo(base);

describe("buildMemo", () => {
  it("หัวบันทึก: วันที่ พ.ศ. เต็ม, เรื่อง, จาก/เรียน/เพื่อ", () => {
    expect(memo).toMatchObject({
      company: "บริษัท น้ำตาลสุรินทร์ จำกัด",
      date: "16 ตุลาคม 2569",
      subject: "ขอเบิกค่าใช้บริการอินเตอร์เน็ต 3BB",
      subjectDetail: "(ห้องรับรองคุณมั่นคง)",
      from: "ฝ่ายรัฐกิจสัมพันธ์และหลักทรัพย์",
      to: "ผู้จัดการฝ่ายบัญชี - ผู้จัดการฝ่ายการเงิน",
      purpose: "โปรดพิจารณา",
    });
  });

  it("ตาราง: ปี/เดือนตามวันครบกำหนด, กำหนดชำระ dd/mm/พ.ศ.", () => {
    expect(memo.tableTitle).toBe("ตารางค่าใช้จ่ายอินเตอร์เน็ตของบริษัทฯ 2569");
    expect(memo.monthHeader).toBe("พฤศจิกายน");
    expect(memo.rows).toEqual([
      { no: 1, customerCode: "600197730", serviceUser: "ห้องรับรองคุณมั่นคง", amount: "749.00", dueDate: "12/11/2569" },
    ]);
    expect(memo.total).toBe("749.00");
  });

  it("ย่อหน้าหลักตรงกับฟอร์มจริง", () => {
    expect(memo.bodyLead + memo.bodyBold + memo.bodyTail).toBe(
      "ฝ่ายรัฐกิจสัมพันธ์และหลักทรัพย์ ขอเบิกค่าใช้บริการอินเตอร์เน็ต จำนวน 1 เลขหมาย รอบค่าใช้บริการ " +
        "เดือน พฤศจิกายน 2569 เป็นจำนวนเงินทั้งสิ้น 749.00 บาท (เจ็ดร้อยสี่สิบเก้าบาทถ้วน) ตามเอกสารที่แนบท้ายนี้",
    );
  });

  it("ผู้ขออนุมัติ = ผู้จัดทำ (ไม่มีตำแหน่งในบัญชี → ตำแหน่งจากค่าตั้ง); ผู้อนุมัติตามที่เลือก; ยังไม่อนุมัติ", () => {
    expect(memo.requester).toEqual({ name: "นางสาวทดสอบ จัดทำ", title: "เจ้าหน้าที่รัฐกิจสัมพันธ์" });
    expect(memo.approver).toEqual(approver);
    expect(memo.approvedNote).toBeNull();
    expect(memo.formCode).toBe("FM-50000-02 Rev.02 วันบังคับใช้ 05/07/2566");
  });

  it("ผู้จัดทำมีตำแหน่งในบัญชี → ใช้ตำแหน่งนั้น", () => {
    const m = buildMemo({ ...base, creator: { name: "นางสาวทดสอบ จัดทำ", title: "เจ้าหน้าที่ธุรการ" } });
    expect(m.requester.title).toBe("เจ้าหน้าที่ธุรการ");
  });

  it("อนุมัติในระบบแล้ว → พิมพ์เวลาอนุมัติ (เวลาไทย, พ.ศ.)", () => {
    const m = buildMemo({ ...base, approvedAt: new Date("2026-10-24T03:30:00Z") });
    expect(m.approvedNote).toBe("อนุมัติในระบบ 24 ต.ค. 2569 10:30 น.");
  });

  it("ยอดมีสตางค์ และข้ามปี", () => {
    const m = buildMemo({ ...base, memoDate: "2026-12-20", amount: "1068.93", dueDate: "2027-01-05" });
    expect(m.tableTitle).toBe("ตารางค่าใช้จ่ายอินเตอร์เน็ตของบริษัทฯ 2570");
    expect(m.bodyBold).toBe("เดือน มกราคม 2570 เป็นจำนวนเงินทั้งสิ้น 1,068.93 บาท (หนึ่งพันหกสิบแปดบาทเก้าสิบสามสตางค์)");
  });
});

describe("ผู้ลงนามที่เลือกต่อใบเบิก", () => {
  const chosen = {
    requester: { name: "นายผู้ขอ คนที่สอง", title: "เจ้าหน้าที่ธุรการ" },
    approver: { name: "นางสาวผู้อนุมัติ แทน", title: "ผู้จัดการแผนก" },
  };

  it("เลือกไว้ → พิมพ์ตามที่เลือก แทนผู้จัดทำ", () => {
    const m = buildMemo({ ...base, signers: chosen });
    expect(m.requester).toEqual(chosen.requester);
    expect(m.approver).toEqual(chosen.approver);
  });

  it("ยังไม่เลือกผู้อนุมัติ → ชื่อ/ตำแหน่งว่าง (PDF พิมพ์จุดไข่ปลาให้เขียนมือ)", () => {
    const m = buildMemo({ ...base, signers: undefined });
    expect(m.approver).toEqual({ name: "", title: "" });
  });

  it("resolveSigners บอกว่าเป็นค่าเริ่มต้นหรือไม่", () => {
    const r = resolveSigners({ requester: chosen.requester, approver: null }, { name: "ผู้จัดทำ", title: null }, settings);
    expect(r.requester).toEqual({ ...chosen.requester, isDefault: false });
    expect(r.approver).toEqual({ name: "", title: "", isDefault: true });
  });

  it("chosenSignersOf: คอลัมน์ null = ค่าเริ่มต้น", () => {
    expect(chosenSignersOf({ requesterName: null, requesterTitle: null, approverName: "ก", approverTitle: "ข" })).toEqual({
      requester: null,
      approver: { name: "ก", title: "ข" },
    });
  });
});
