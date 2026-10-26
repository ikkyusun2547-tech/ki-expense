import type { ServiceKind } from "@/generated/prisma/enums";
import { formatPhone } from "@/lib/centers/phone";
import { formatAmount, type AmountInput } from "@/lib/money";
import { bahtText } from "@/lib/thai/bahtText";
import { beYear, formatBEDate, formatThaiDate, formatThaiDateTime, thaiMonthName, type ISODate } from "@/lib/thai/date";

// ข้อมูลบนใบเบิกแบบ "บันทึกภายใน" (FM-50000-02) — แยกจากหน้าตา PDF เพื่อทดสอบข้อความได้ตรง ๆ
// วันที่ทุกจุดเป็น พ.ศ. ตามฟอร์มจริง; ค่าอินเทอร์เน็ตกับค่าโทรศัพท์ใช้ฟอร์มเดียวกัน ต่างแค่ข้อความ (KIND_TEXT)

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

// ใบแรกของผู้จัดทำในแต่ละประเภท (ค่าโทรศัพท์: ตามฟอร์มจริงที่ผู้ใช้ส่งมา 2026-10-26)
export const DEFAULT_MEMO_TEXTS_BY_KIND: Record<ServiceKind, MemoTexts> = {
  INTERNET: DEFAULT_MEMO_TEXTS,
  PHONE: {
    department: "ฝ่ายรัฐกิจสัมพันธ์และหลักทรัพย์",
    recipient: "ผู้จัดการฝ่ายบัญชี - ผู้จัดการฝ่ายการเงิน",
    purpose: "โปรดพิจารณาดำเนินการ",
  },
};

// ช่องที่เว้นว่าง = ข้อความตามฟอร์มจริงของประเภทนั้น
export function fillMemoTexts(texts: MemoTexts, kind: ServiceKind): MemoTexts {
  const d = DEFAULT_MEMO_TEXTS_BY_KIND[kind];
  return { department: texts.department || d.department, recipient: texts.recipient || d.recipient, purpose: texts.purpose || d.purpose };
}

// ระบบ (ค่าย) เริ่มต้นของศูนย์ (ค่าอินเทอร์เน็ต) — แต่ละศูนย์เลือกค่ายได้ในทะเบียนศูนย์
export const INTERNET_PROVIDER = "3BB";

// ข้อความที่ต่างกันตามประเภท (ช่องว่างในข้อความคงที่ = จุดที่ยอมให้ขึ้นบรรทัดใหม่ใน PDF)
const KIND_TEXT: Record<ServiceKind, { subject: string; service: string; intro: string; table: string; codeHeader: string; attached: string }> = {
  INTERNET: {
    subject: "ขอเบิกค่าใช้บริการอินเตอร์เน็ต", // + ค่ายของศูนย์ (ตามฟอร์มจริง: "... อินเตอร์เน็ต 3BB")
    service: "อินเตอร์เน็ต",
    intro: "เนื่องด้วย บริษัท น้ำตาลสุรินทร์ จำกัด ได้เปิดใช้บริการอินเตอร์เน็ต เพื่ออำนวยความสะดวกในการทำงานภายในบริษัทฯ",
    table: "ตารางค่าใช้จ่ายอินเตอร์เน็ตของบริษัทฯ",
    codeHeader: "รหัสลูกค้า",
    attached: "ตามเอกสารที่แนบท้ายนี้",
  },
  PHONE: {
    subject: "ขอเบิกค่าใช้บริการโทรศัพท์",
    service: "โทรศัพท์",
    intro: "เนื่องด้วย บริษัท น้ำตาลสุรินทร์ จำกัด ได้เปิดใช้บริการหมายเลขโทรศัพท์ เพื่ออำนวยความสะดวกในการทำงานภายในบริษัทฯ",
    table: "ตารางค่าใช้จ่ายโทรศัพท์เคลื่อนที่ของบริษัทฯ",
    codeHeader: "หมายเลขโทรศัพท์",
    attached: "ตามเอกสารที่แนบมาพร้อมนี้",
  },
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
  kind?: ServiceKind; // ไม่ส่ง = ค่าอินเทอร์เน็ต
  memoDate: ISODate; // วันที่ของบันทึก (วันที่สร้างใบเบิก ตามเวลาไทย)
  customerCode: string; // อินเทอร์เน็ต = รหัสลูกค้า, โทรศัพท์ = หมายเลข (ตัวเลขล้วน)
  provider?: string; // ระบบ (ค่าย) — อินเทอร์เน็ตไม่ส่ง/ว่าง = 3BB
  serviceUser: string; // ผู้ใช้บริการ = ชื่อศูนย์ / ฝ่ายที่ใช้เบอร์
  amount: AmountInput;
  dueDate: ISODate;
  periodEnd?: ISODate; // วันสิ้นสุดรอบบริการ — ค่าโทรศัพท์ใช้เป็นเดือนของรอบค่าใช้บริการ
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
  codeHeader: string; // หัวคอลัมน์ที่ 2: รหัสลูกค้า / หมายเลขโทรศัพท์
  monthHeader: string;
  rows: { no: number; customerCode: string; provider: string; serviceUser: string; amount: string; dueDate: string }[];
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
  const kind = input.kind ?? "INTERNET";
  const k = KIND_TEXT[kind];
  const amount = formatAmount(input.amount);
  const lines = 1; // v1: 1 ใบเบิก = 1 ศูนย์/เบอร์ = 1 เลขหมาย
  const { requester, approver } = resolveSigners(input.signers, input.creator);
  const code = kind === "PHONE" ? formatPhone(input.customerCode) : input.customerCode;
  const provider = input.provider || (kind === "INTERNET" ? INTERNET_PROVIDER : "");
  // เดือนของรอบค่าใช้บริการ (หัวคอลัมน์เดือน / ปีตาราง / ย่อหน้า):
  // อินเทอร์เน็ต = เดือนของวันครบกำหนด (ผู้ใช้ยืนยันตามฟอร์มจริง), โทรศัพท์ = เดือนที่รอบบริการสิ้นสุด
  // (ฟอร์มจริง + บิล True: รอบ 16 ก.ย.–15 ต.ค. = "รอบค่าใช้บริการเดือน ตุลาคม" แม้ครบกำหนด 09/11 — ผู้ใช้เลือก 2026-10-26)
  const month = kind === "PHONE" && input.periodEnd ? input.periodEnd : input.dueDate;

  return {
    company: COMPANY_NAME,
    date: formatThaiDate(input.memoDate, "long"),
    subject: kind === "INTERNET" ? `${k.subject} ${provider}` : k.subject,
    // อินเทอร์เน็ต: ชื่อศูนย์ใต้เรื่อง (ตามฟอร์มจริง) / โทรศัพท์: ไม่มี
    subjectDetail: kind === "INTERNET" ? `(${input.serviceUser})` : "",
    from: s.department,
    to: s.recipient,
    purpose: s.purpose,
    intro: k.intro,
    tableTitle: `${k.table} ${beYear(month)}`,
    codeHeader: k.codeHeader,
    monthHeader: thaiMonthName(month),
    rows: [{ no: 1, customerCode: code, provider, serviceUser: input.serviceUser, amount, dueDate: formatBEDate(input.dueDate) }],
    total: amount,
    bodyLead: `${s.department} ขอเบิกค่าใช้บริการ${k.service} จำนวน ${lines} เลขหมาย รอบค่าใช้บริการ `,
    bodyBold: `เดือน ${thaiMonthName(month)} ${beYear(month)} เป็นจำนวนเงินทั้งสิ้น ${amount} บาท (${bahtText(input.amount)})`,
    bodyTail: ` ${k.attached}`,
    // ฟอร์มจริงทั้งสองแบบ: "จึงเรียนมาเพื่อ" + ข้อความช่อง "เพื่อ"
    closing: `จึงเรียนมาเพื่อ${s.purpose}`,
    requester: { name: requester.name, title: requester.title },
    approver: { name: approver.name, title: approver.title },
    approvedNote: input.approvedAt ? `อนุมัติในระบบ ${formatThaiDateTime(input.approvedAt)} น.` : null,
    formCode: FORM_CODE,
  };
}
