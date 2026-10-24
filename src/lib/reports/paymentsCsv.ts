import { formatAmount, toSatang, type AmountInput } from "@/lib/money";
import { beYear, formatBEDate, thaiMonthName, type ISODate } from "@/lib/thai/date";

// รายงานการจ่ายรายเดือน (ฝ่ายบัญชี) เป็น CSV ที่เปิดด้วย Excel ได้เลย
// - ขึ้นต้นด้วย BOM ให้ Excel อ่านภาษาไทย (UTF-8) ถูก, ขึ้นบรรทัดแบบ CRLF
// - ยอดเป็นตัวเลขไม่มีจุลภาค (Excel รวมได้), วันที่เป็น วว/ดด/ปปปป พ.ศ.

export type PaymentRow = {
  paidDate: ISODate;
  centerName: string;
  customerCode: string;
  invoiceNo: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  dueDate: ISODate;
  amount: AmountInput;
  paymentRef: string;
  approverName: string | null;
};

const HEADER = ["ลำดับ", "วันที่จ่าย", "ศูนย์", "รหัสลูกค้า", "เลขที่ใบแจ้งหนี้", "รอบบริการ", "ครบกำหนดชำระ", "ยอด (บาท)", "เลขอ้างอิงการจ่าย", "ผู้อนุมัติ"];

// ครอบด้วย " เมื่อมี , " หรือขึ้นบรรทัด; ค่าที่ขึ้นต้นด้วย = + - @ ใส่ ' นำหน้า กัน Excel ตีความเป็นสูตร
function cell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const plain = (amount: AmountInput) => formatAmount(amount).replace(/,/g, "");

export function paymentsCsv(month: string, rows: PaymentRow[]): string {
  const total = rows.reduce((sum, r) => sum + toSatang(r.amount), BigInt(0));
  const totalText = `${total / BigInt(100)}.${String(total % BigInt(100)).padStart(2, "0")}`;
  const first = `${month}-01`;

  const lines = [
    [`สรุปการจ่ายค่าอินเทอร์เน็ต เดือน${thaiMonthName(first)} ${beYear(first)}`],
    HEADER,
    ...rows.map((r, i) => [
      String(i + 1),
      formatBEDate(r.paidDate),
      r.centerName,
      r.customerCode,
      r.invoiceNo,
      `${formatBEDate(r.periodStart)} - ${formatBEDate(r.periodEnd)}`,
      formatBEDate(r.dueDate),
      plain(r.amount),
      r.paymentRef,
      r.approverName ?? "",
    ]),
    ["", "", "", "", "", "", `รวม ${rows.length} รายการ`, totalText, "", ""],
  ];
  return "﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n";
}
