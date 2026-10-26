import type { CenterStatus, ServiceKind } from "@/generated/prisma/enums";
import { formatAmount, parseAmount, toSatang } from "@/lib/money";
import { centerStatusLabel } from "@/lib/status";
import { daysInclusive, formatThaiDate, isISODate, periodsOverlap, type ISODate } from "@/lib/thai/date";

// กฎตรวจใบเบิกก่อนสร้าง/แก้ไข — pure function ไม่แตะ DB
// blocks = ห้ามบันทึก, warnings = บันทึกได้แต่ผู้ใช้ต้องกดยืนยันอีกครั้ง

export const PERIOD_MIN_DAYS = 25;
export const PERIOD_MAX_DAYS = 35;

export type RequestDraft = {
  invoiceNo: string;
  amount: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  dueDate: ISODate;
  hasFile: boolean;
};

export type CenterForRules = {
  status: CenterStatus;
  normalAmount: string;
  kind?: ServiceKind; // ใช้เลือกคำในข้อความ (ศูนย์ / เบอร์) — ไม่ส่ง = ศูนย์
};

// ใบเบิกเดิมของศูนย์เดียวกันที่ยังไม่ถูกลบ (ตอนแก้ไข ผู้เรียกต้องตัดใบที่กำลังแก้ออกเอง)
export type ExistingPeriod = {
  periodStart: ISODate;
  periodEnd: ISODate;
};

export type IssueCode =
  | "CENTER_INACTIVE"
  | "MISSING_FIELD"
  | "INVALID_AMOUNT"
  | "INVALID_DATE"
  | "PERIOD_REVERSED"
  | "PERIOD_OVERLAP"
  | "AMOUNT_DIFFERS"
  | "PERIOD_LENGTH"
  | "NO_FILE";

export type Issue = { code: IssueCode; message: string };

export type RuleResult = { blocks: Issue[]; warnings: Issue[] };

const FIELD_LABEL = {
  invoiceNo: "เลขที่ใบแจ้งหนี้",
  amount: "ยอด",
  periodStart: "รอบบริการเริ่ม",
  periodEnd: "รอบบริการสิ้นสุด",
  dueDate: "วันครบกำหนด",
} as const;

type DateField = "periodStart" | "periodEnd" | "dueDate";

export function checkRequest(
  draft: RequestDraft,
  center: CenterForRules,
  existing: ExistingPeriod[],
): RuleResult {
  const blocks: Issue[] = [];
  const warnings: Issue[] = [];

  const noun = center.kind === "PHONE" ? "เบอร์" : "ศูนย์";

  if (center.status !== "ACTIVE") {
    blocks.push({
      code: "CENTER_INACTIVE",
      message: `${noun}สถานะ "${centerStatusLabel(center.status, center.kind)}" เบิกไม่ได้`,
    });
  }

  const missing = (Object.keys(FIELD_LABEL) as (keyof typeof FIELD_LABEL)[]).filter(
    (f) => draft[f].trim() === "",
  );
  if (missing.length) {
    blocks.push({
      code: "MISSING_FIELD",
      message: `กรอกข้อมูลไม่ครบ: ${missing.map((f) => FIELD_LABEL[f]).join(", ")}`,
    });
  }

  const amount = draft.amount.trim() === "" ? null : parseAmount(draft.amount);
  if (draft.amount.trim() !== "" && (amount === null || toSatang(amount) === BigInt(0))) {
    blocks.push({ code: "INVALID_AMOUNT", message: "ยอดต้องเป็นตัวเลขมากกว่า 0 ทศนิยมไม่เกิน 2 ตำแหน่ง" });
  }

  const dateFields: DateField[] = ["periodStart", "periodEnd", "dueDate"];
  const badDates = dateFields.filter((f) => draft[f].trim() !== "" && !isISODate(draft[f]));
  if (badDates.length) {
    blocks.push({
      code: "INVALID_DATE",
      message: `วันที่ไม่ถูกต้อง: ${badDates.map((f) => FIELD_LABEL[f]).join(", ")}`,
    });
  }

  const periodValid = isISODate(draft.periodStart) && isISODate(draft.periodEnd);
  const periodReversed = periodValid && draft.periodEnd < draft.periodStart;
  if (periodReversed) {
    blocks.push({ code: "PERIOD_REVERSED", message: "รอบบริการสิ้นสุดก่อนวันเริ่ม" });
  }

  if (periodValid && !periodReversed) {
    const clash = existing.find((e) =>
      periodsOverlap(draft.periodStart, draft.periodEnd, e.periodStart, e.periodEnd),
    );
    if (clash) {
      blocks.push({
        code: "PERIOD_OVERLAP",
        message: `${noun}นี้มีใบเบิกรอบ ${formatThaiDate(clash.periodStart)} – ${formatThaiDate(clash.periodEnd)} อยู่แล้ว (รอบบริการทับกัน)`,
      });
    }

    const days = daysInclusive(draft.periodStart, draft.periodEnd);
    if (days < PERIOD_MIN_DAYS || days > PERIOD_MAX_DAYS) {
      warnings.push({
        code: "PERIOD_LENGTH",
        message: `รอบบริการ ${days} วัน (ปกติ ${PERIOD_MIN_DAYS}–${PERIOD_MAX_DAYS} วัน)`,
      });
    }
  }

  if (amount !== null && toSatang(amount) !== toSatang(center.normalAmount)) {
    warnings.push({
      code: "AMOUNT_DIFFERS",
      message: `ยอด ${formatAmount(amount)} บาท ต่างจากยอดปกติ ${formatAmount(center.normalAmount)} บาท`,
    });
  }

  if (!draft.hasFile) {
    warnings.push({ code: "NO_FILE", message: "ยังไม่ได้แนบไฟล์ใบแจ้งหนี้" });
  }

  return { blocks, warnings };
}

// คำเตือนที่ไม่ต้องกดยืนยันซ้ำ (ผู้ใช้ขอ 2026-10-26 — ยอดเปลี่ยนทุกเดือนเป็นเรื่องปกติ)
// ยังแสดงในหน้าจอ (ใต้ช่องยอด / หน้าใบเบิก) แต่บันทึกได้เลย
const INFO_ONLY: readonly IssueCode[] = ["AMOUNT_DIFFERS"];

// มีคำเตือนที่ต้องให้ผู้ใช้ตรวจแล้วกดยืนยันก่อนบันทึกไหม
export function needsConfirm(warnings: readonly Issue[]): boolean {
  return warnings.some((w) => !INFO_ONLY.includes(w.code));
}
