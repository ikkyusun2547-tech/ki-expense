import { describe, expect, it } from "vitest";
import {
  buildMemo,
  chosenSignersOf,
  DEFAULT_MEMO_TEXTS,
  DEFAULT_MEMO_TEXTS_BY_KIND,
  fillMemoTexts,
  resolveSigners,
} from "@/lib/pdf/memoData";

// ตัวอย่างจากฟอร์มจริง: บันทึกภายใน 16 ต.ค. 2569 ห้องรับรองคุณมั่นคง 749.00 ครบกำหนด 12/11/2569
const texts = { ...DEFAULT_MEMO_TEXTS, department: "ฝ่ายรัฐกิจสัมพันธ์และหลักทรัพย์" };

const approver = { name: "นายทดสอบ อนุมัติ", title: "รักษาการผู้จัดการส่วนรัฐกิจและหลักทรัพย์" };

const base = {
  memoDate: "2026-10-16",
  customerCode: "600197730",
  serviceUser: "ห้องรับรองคุณมั่นคง",
  amount: "749",
  dueDate: "2026-11-12",
  creator: { name: "นางสาวทดสอบ จัดทำ", title: "เจ้าหน้าที่รัฐกิจสัมพันธ์" },
  signers: { requester: null, approver },
  texts,
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
      { no: 1, customerCode: "600197730", provider: "3BB", serviceUser: "ห้องรับรองคุณมั่นคง", amount: "749.00", dueDate: "12/11/2569" },
    ]);
    expect(memo.codeHeader).toBe("รหัสลูกค้า");
    expect(memo.total).toBe("749.00");
    expect(memo.closing).toBe("จึงเรียนมาเพื่อโปรดพิจารณา");
  });

  it("ย่อหน้าหลักตรงกับฟอร์มจริง", () => {
    expect(memo.bodyLead + memo.bodyBold + memo.bodyTail).toBe(
      "ฝ่ายรัฐกิจสัมพันธ์และหลักทรัพย์ ขอเบิกค่าใช้บริการอินเตอร์เน็ต จำนวน 1 เลขหมาย รอบค่าใช้บริการ " +
        "เดือน พฤศจิกายน 2569 เป็นจำนวนเงินทั้งสิ้น 749.00 บาท (เจ็ดร้อยสี่สิบเก้าบาทถ้วน) ตามเอกสารที่แนบท้ายนี้",
    );
  });

  it("ผู้ขออนุมัติ = ผู้จัดทำ + ตำแหน่งในบัญชี; ผู้อนุมัติตามที่เลือก; ยังไม่อนุมัติ; รหัสฟอร์มคงที่", () => {
    expect(memo.requester).toEqual({ name: "นางสาวทดสอบ จัดทำ", title: "เจ้าหน้าที่รัฐกิจสัมพันธ์" });
    expect(memo.approver).toEqual(approver);
    expect(memo.requesterDate).toBe("วันที่ ......../......../........"); // ยังไม่ส่ง → เว้นให้เขียนมือ
    expect(memo.approverDate).toBe("วันที่ ......../......../........");
    expect(memo.formCode).toBe("FM-50000-02 Rev.02 วันบังคับใช้ 05/07/2566");
  });

  it("ผู้จัดทำมีตำแหน่งในบัญชี → ใช้ตำแหน่งนั้น", () => {
    const m = buildMemo({ ...base, creator: { name: "นางสาวทดสอบ จัดทำ", title: "เจ้าหน้าที่ธุรการ" } });
    expect(m.requester.title).toBe("เจ้าหน้าที่ธุรการ");
  });

  it("ส่ง/อนุมัติในระบบแล้ว → วันที่ใต้ลายเซ็น (เวลาไทย, พ.ศ.)", () => {
    const m = buildMemo({ ...base, submittedAt: new Date("2026-10-23T17:30:00Z"), approvedAt: new Date("2026-10-24T03:30:00Z") });
    expect(m.requesterDate).toBe("วันที่ 24/10/2569"); // 00:30 น. เวลาไทย = วันถัดไปของ UTC
    expect(m.approverDate).toBe("วันที่ 24/10/2569 (อนุมัติในระบบ 10:30 น.)");
  });

  it("ค่ายของศูนย์ (ทะเบียนศูนย์) → ทั้งเรื่องและคอลัมน์ระบบ", () => {
    const m = buildMemo({ ...base, provider: "TRUE" });
    expect(m.subject).toBe("ขอเบิกค่าใช้บริการอินเตอร์เน็ต TRUE");
    expect(m.rows[0].provider).toBe("TRUE");
  });

  it("ยอดมีสตางค์ และข้ามปี", () => {
    const m = buildMemo({ ...base, memoDate: "2026-12-20", amount: "1068.93", dueDate: "2027-01-05" });
    expect(m.tableTitle).toBe("ตารางค่าใช้จ่ายอินเตอร์เน็ตของบริษัทฯ 2570");
    expect(m.bodyBold).toBe("เดือน มกราคม 2570 เป็นจำนวนเงินทั้งสิ้น 1,068.93 บาท (หนึ่งพันหกสิบแปดบาทเก้าสิบสามสตางค์)");
  });
});

// ตัวอย่างจากฟอร์มจริงค่าโทรศัพท์: บันทึกภายใน 19 ต.ค. 2569 เบอร์ 097-3378822 TRUE รัฐกิจสัมพันธ์ 408.40 ครบกำหนด 09/11/2569
describe("buildMemo ค่าโทรศัพท์", () => {
  const phone = buildMemo({
    ...base,
    kind: "PHONE",
    memoDate: "2026-10-19",
    customerCode: "0973378822",
    provider: "TRUE",
    serviceUser: "รัฐกิจสัมพันธ์",
    amount: "408.40",
    dueDate: "2026-11-09",
    periodEnd: "2026-10-15", // รอบ 16 ก.ย. – 15 ต.ค. 2569
    texts: DEFAULT_MEMO_TEXTS_BY_KIND.PHONE,
  });

  it("หัวบันทึก: เรื่องค่าโทรศัพท์ ไม่มีบรรทัดชื่อศูนย์, เพื่อ = โปรดพิจารณาดำเนินการ", () => {
    expect(phone).toMatchObject({
      date: "19 ตุลาคม 2569",
      subject: "ขอเบิกค่าใช้บริการโทรศัพท์",
      subjectDetail: "",
      from: "ฝ่ายรัฐกิจสัมพันธ์และหลักทรัพย์",
      to: "ผู้จัดการฝ่ายบัญชี - ผู้จัดการฝ่ายการเงิน",
      purpose: "โปรดพิจารณาดำเนินการ",
    });
  });

  it("ตาราง: หมายเลขโทรศัพท์แบบมีขีด + ระบบ", () => {
    expect(phone.tableTitle).toBe("ตารางค่าใช้จ่ายโทรศัพท์เคลื่อนที่ของบริษัทฯ 2569");
    expect(phone.monthHeader).toBe("ตุลาคม"); // เดือนของรอบบริการ ไม่ใช่เดือนครบกำหนด (พ.ย.)
    expect(phone.codeHeader).toBe("หมายเลขโทรศัพท์");
    expect(phone.rows).toEqual([
      { no: 1, customerCode: "097-3378822", provider: "TRUE", serviceUser: "รัฐกิจสัมพันธ์", amount: "408.40", dueDate: "09/11/2569" },
    ]);
  });

  it("ย่อหน้าหลักและคำปิดตรงกับฟอร์มจริง", () => {
    expect(phone.bodyLead + phone.bodyBold + phone.bodyTail).toBe(
      "ฝ่ายรัฐกิจสัมพันธ์และหลักทรัพย์ ขอเบิกค่าใช้บริการโทรศัพท์ จำนวน 1 เลขหมาย รอบค่าใช้บริการ " +
        "เดือน ตุลาคม 2569 เป็นจำนวนเงินทั้งสิ้น 408.40 บาท (สี่ร้อยแปดบาทสี่สิบสตางค์) ตามเอกสารที่แนบมาพร้อมนี้",
    );
    expect(phone.closing).toBe("จึงเรียนมาเพื่อโปรดพิจารณาดำเนินการ");
  });

  it("เดือนของรอบบริการข้ามปี: รอบสิ้นสุด 15 ธ.ค. 2569 ครบกำหนด ม.ค. 2570 → ธันวาคม 2569", () => {
    const m = buildMemo({ ...base, kind: "PHONE", customerCode: "0973378822", periodEnd: "2026-12-15", dueDate: "2027-01-09", texts });
    expect([m.monthHeader, m.tableTitle.slice(-4)]).toEqual(["ธันวาคม", "2569"]);
  });

  it("ค่าอินเทอร์เน็ตยังใช้เดือนของวันครบกำหนด แม้ส่ง periodEnd มา", () => {
    expect(buildMemo({ ...base, periodEnd: "2026-10-31" }).monthHeader).toBe("พฤศจิกายน");
  });

  it("fillMemoTexts: ช่องว่างใช้ข้อความตามฟอร์มของประเภทนั้น", () => {
    expect(fillMemoTexts({ department: "", recipient: "ผู้จัดการ", purpose: "" }, "PHONE")).toEqual({
      department: "ฝ่ายรัฐกิจสัมพันธ์และหลักทรัพย์",
      recipient: "ผู้จัดการ",
      purpose: "โปรดพิจารณาดำเนินการ",
    });
    expect(fillMemoTexts({ department: "", recipient: "", purpose: "" }, "INTERNET")).toEqual(DEFAULT_MEMO_TEXTS);
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
    const r = resolveSigners({ requester: chosen.requester, approver: null }, { name: "ผู้จัดทำ", title: null });
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
