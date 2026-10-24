import { describe, expect, it } from "vitest";
import { buildMemo, DEFAULT_MEMO_SETTINGS } from "@/lib/pdf/memoData";

// ตัวอย่างจากฟอร์มจริง: บันทึกภายใน 16 ต.ค. 2569 ห้องรับรองคุณมั่นคง 749.00 ครบกำหนด 12/11/2569
const settings = {
  ...DEFAULT_MEMO_SETTINGS,
  department: "ฝ่ายรัฐกิจสัมพันธ์และหลักทรัพย์",
  requesterTitle: "เจ้าหน้าที่รัฐกิจสัมพันธ์",
  approverName: "นายทดสอบ อนุมัติ",
  approverTitle: "รักษาการผู้จัดการส่วนรัฐกิจและหลักทรัพย์",
};

const memo = buildMemo({
  memoDate: "2026-10-16",
  customerCode: "600197730",
  serviceUser: "ห้องรับรองคุณมั่นคง",
  amount: "749",
  dueDate: "2026-11-12",
  requesterName: "นางสาวทดสอบ จัดทำ",
  settings,
});

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

  it("ผู้ขออนุมัติ = ผู้จัดทำ + ตำแหน่งจากการตั้งค่า; ผู้อนุมัติจากการตั้งค่า", () => {
    expect(memo.requester).toEqual({ name: "นางสาวทดสอบ จัดทำ", title: "เจ้าหน้าที่รัฐกิจสัมพันธ์" });
    expect(memo.approver).toEqual({ name: "นายทดสอบ อนุมัติ", title: "รักษาการผู้จัดการส่วนรัฐกิจและหลักทรัพย์" });
    expect(memo.formCode).toBe("FM-50000-02 Rev.02 วันบังคับใช้ 05/07/2566");
  });

  it("ยอดมีสตางค์ และข้ามปี", () => {
    const m = buildMemo({ ...{ memoDate: "2026-12-20", customerCode: "1", serviceUser: "x", requesterName: "x", settings }, amount: "1068.93", dueDate: "2027-01-05" });
    expect(m.tableTitle).toBe("ตารางค่าใช้จ่ายอินเตอร์เน็ตของบริษัทฯ 2570");
    expect(m.bodyBold).toBe("เดือน มกราคม 2570 เป็นจำนวนเงินทั้งสิ้น 1,068.93 บาท (หนึ่งพันหกสิบแปดบาทเก้าสิบสามสตางค์)");
  });
});
