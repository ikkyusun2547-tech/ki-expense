import { formatAmount, type AmountInput } from "@/lib/money";
import { bahtText } from "@/lib/thai/bahtText";
import { beYear, formatBEDate, formatThaiDate, formatThaiDateTime, thaiMonthName, type ISODate } from "@/lib/thai/date";

// ข้อมูลบนใบเบิกแบบ "บันทึกภายใน" (FM-50000-02) — แยกจากหน้าตา PDF เพื่อทดสอบข้อความได้ตรง ๆ
// วันที่ทุกจุดเป็น พ.ศ. ตามฟอร์มจริง

export const COMPANY_NAME = "บริษัท น้ำตาลสุรินทร์ จำกัด";

// ข้อความหัวบันทึกของแต่ละใบ (ผู้จัดทำกรอกในฟอร์ม ค่าเริ่มต้น = ใบล่าสุดของตน)
export type MemoTexts = {
  department: string; // จาก (ฝ่าย) — ใช้ในย่อหน้า "... ขอเบิกค่าใช้บริการ" ด้วย
  recipient: string; // เรียน
  purpose: string; // เพื่อ
};

// ใบแรกของผู้จัดทำ: ฝ่ายตามสเปกเดิม, เรียน/เพื่อ ตามฟอร์มจริง (ตรงกับค่าใน migration request_memo_texts)
export const DEFAULT_MEMO_TEXTS: MemoTexts = {
  department: "ฝ่ายจัดหาวัตถุดิบ",
  recipient: "ผู้จัดการฝ่ายบัญชี - ผู้จัดการฝ่ายการเงิน",
  purpose: "โปรดพิจารณา",
};

// รหัสฟอร์มท้ายกระดาษ — ฟอร์มออกรุ่นใหม่ให้แก้ที่นี่
export const FORM_CODE = "FM-50000-02 Rev.02 วันบังคับใช้ 05/07/2566";

export type SignerText = { name: string; title: string };

// ผู้ลงนามที่เลือกไว้กับใบเบิก (สำเนาชื่อ/ตำแหน่งของบัญชีผู้ใช้ ณ ตอนเลือก) — null = ค่าเริ่มต้น
export type ChosenSigners = { requester: SignerText | null; approver: SignerText | null };

export type ResolvedSigner = SignerText & { isDefault: boolean };

// ผู้จัดทำที่สร้างใบ (ตำแหน่งจากบัญชีผู้ใช้ — บังคับใส่สำหรับผู้จัดทำ)
export type Creator = { name: string; title: string | null };

// ค่าเริ่มต้น: ผู้ขออนุมัติ = ผู้จัดทำ, ผู้อนุมัติ = ยังไม่เลือก (ชื่อ/ตำแหน่งว่าง = เว้นให้เขียนมือ)
export function resolveSigners(
  chosen: ChosenSigners | undefined,
  creator: Creator,
): { requester: ResolvedSigner; approver: ResolvedSigner } {
  return {
    requester: chosen?.requester
      ? { ...chosen.requester, isDefault: false }
      : { name: creator.name, title: creator.title ?? "", isDefault: true },
    approver: chosen?.approver ? { ...chosen.approver, isDefault: false } : { name: "", title: "", isDefault: true },
  };
}

// คอลัมน์สำเนาผู้ลงนามในตาราง Request → ChosenSigners
export function chosenSignersOf(row: {
  requesterName: string | null;
  requesterTitle: string | null;
  approverName: string | null;
  approverTitle: string | null;
}): ChosenSigners {
  return {
    requester: row.requesterName !== null ? { name: row.requesterName, title: row.requesterTitle ?? "" } : null,
    approver: row.approverName !== null ? { name: row.approverName, title: row.approverTitle ?? "" } : null,
  };
}

export type MemoInput = {
  memoDate: ISODate; // วันที่ของบันทึก (วันที่สร้างใบเบิก ตามเวลาไทย)
  customerCode: string;
  serviceUser: string; // ผู้ใช้บริการ = ชื่อศูนย์
  amount: AmountInput;
  dueDate: ISODate;
  creator: Creator; // ผู้จัดทำ (ผู้ขออนุมัติค่าเริ่มต้น)
  signers?: ChosenSigners; // ผู้ลงนามที่เลือกไว้กับใบเบิก
  approvedAt?: Date | null; // อนุมัติในระบบแล้ว → พิมพ์เวลาอนุมัติใต้ชื่อผู้อนุมัติ
  texts: MemoTexts;
};

export type MemoData = {
  company: string;
  date: string;
  subject: string;
  subjectDetail: string;
  from: string;
  to: string;
  purpose: string;
  intro: string;
  tableTitle: string;
  monthHeader: string;
  rows: { no: number; customerCode: string; serviceUser: string; amount: string; dueDate: string }[];
  total: string;
  // ย่อหน้าหลัก แยกส่วนตัวหนาตามฟอร์ม
  bodyLead: string;
  bodyBold: string;
  bodyTail: string;
  closing: string;
  requester: { name: string; title: string };
  approver: { name: string; title: string };
  approvedNote: string | null; // "อนุมัติในระบบ 24 ต.ค. 2569 10:30 น."
  formCode: string;
};

export function buildMemo(input: MemoInput): MemoData {
  const { texts: s } = input;
  const amount = formatAmount(input.amount);
  const lines = 1; // v1: 1 ใบเบิก = 1 ศูนย์ = 1 เลขหมาย
  const { requester, approver } = resolveSigners(input.signers, input.creator);

  return {
    company: COMPANY_NAME,
    date: formatThaiDate(input.memoDate, "long"),
    subject: "ขอเบิกค่าใช้บริการอินเตอร์เน็ต 3BB",
    subjectDetail: `(${input.serviceUser})`,
    from: s.department,
    to: s.recipient,
    purpose: s.purpose,
    intro: "เนื่องด้วย บริษัท น้ำตาลสุรินทร์ จำกัด ได้เปิดใช้บริการอินเตอร์เน็ต เพื่ออำนวยความสะดวกในการทำงานภายในบริษัทฯ",
    tableTitle: `ตารางค่าใช้จ่ายอินเตอร์เน็ตของบริษัทฯ ${beYear(input.dueDate)}`,
    monthHeader: thaiMonthName(input.dueDate),
    rows: [{ no: 1, customerCode: input.customerCode, serviceUser: input.serviceUser, amount, dueDate: formatBEDate(input.dueDate) }],
    total: amount,
    bodyLead: `${s.department} ขอเบิกค่าใช้บริการอินเตอร์เน็ต จำนวน ${lines} เลขหมาย รอบค่าใช้บริการ `,
    bodyBold: `เดือน ${thaiMonthName(input.dueDate)} ${beYear(input.dueDate)} เป็นจำนวนเงินทั้งสิ้น ${amount} บาท (${bahtText(input.amount)})`,
    bodyTail: " ตามเอกสารที่แนบท้ายนี้",
    closing: "จึงเรียนมาเพื่อโปรดพิจารณา",
    requester: { name: requester.name, title: requester.title },
    approver: { name: approver.name, title: approver.title },
    approvedNote: input.approvedAt ? `อนุมัติในระบบ ${formatThaiDateTime(input.approvedAt)} น.` : null,
    formCode: FORM_CODE,
  };
}
