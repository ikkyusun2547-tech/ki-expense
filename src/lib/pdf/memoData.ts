import { formatAmount, type AmountInput } from "@/lib/money";
import { bahtText } from "@/lib/thai/bahtText";
import { beYear, formatBEDate, formatThaiDate, thaiMonthName, type ISODate } from "@/lib/thai/date";

// ข้อมูลบนใบเบิกแบบ "บันทึกภายใน" (FM-50000-02) — แยกจากหน้าตา PDF เพื่อทดสอบข้อความได้ตรง ๆ
// วันที่ทุกจุดเป็น พ.ศ. ตามฟอร์มจริง

export const COMPANY_NAME = "บริษัท น้ำตาลสุรินทร์ จำกัด";

export type MemoSettings = {
  department: string;
  recipient: string;
  purpose: string;
  requesterTitle: string;
  approverName: string;
  approverTitle: string;
  formCode: string;
};

// ค่าเริ่มต้นก่อน admin ตั้งค่า: ฝ่าย/ตำแหน่งตามสเปกเดิม, เรียน/เพื่อ/รหัสฟอร์ม ตามฟอร์มจริง
export const DEFAULT_MEMO_SETTINGS: MemoSettings = {
  department: "ฝ่ายจัดหาวัตถุดิบ",
  recipient: "ผู้จัดการฝ่ายบัญชี - ผู้จัดการฝ่ายการเงิน",
  purpose: "โปรดพิจารณา",
  requesterTitle: "เจ้าหน้าที่บริหารงาน GPS",
  approverName: "",
  approverTitle: "ผู้จัดการส่วนสำนักงานจัดหาวัตถุดิบ",
  formCode: "FM-50000-02 Rev.02 วันบังคับใช้ 05/07/2566",
};

export type MemoInput = {
  memoDate: ISODate; // วันที่ของบันทึก (วันที่สร้างใบเบิก ตามเวลาไทย)
  customerCode: string;
  serviceUser: string; // ผู้ใช้บริการ = ชื่อศูนย์
  amount: AmountInput;
  dueDate: ISODate;
  requesterName: string; // ชื่อผู้จัดทำ
  settings: MemoSettings;
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
  formCode: string;
};

export function buildMemo(input: MemoInput): MemoData {
  const { settings: s } = input;
  const amount = formatAmount(input.amount);
  const lines = 1; // v1: 1 ใบเบิก = 1 ศูนย์ = 1 เลขหมาย

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
    requester: { name: input.requesterName, title: s.requesterTitle },
    approver: { name: s.approverName, title: s.approverTitle },
    formCode: s.formCode,
  };
}
