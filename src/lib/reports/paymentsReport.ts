import type { Row, SheetData, SheetOptions } from "write-excel-file/node";
import { toSatang, type AmountInput } from "@/lib/money";
import type { ServiceKind } from "@/generated/prisma/enums";
import { beYear, formatBEDate, thaiMonthName, type ISODate } from "@/lib/thai/date";
import { amount, border, COLOR, headerStyle, noteStyle, printSetup, spanRow, text, titleStyle, type CellStyle, type FileContent } from "./xlsx";

// รายงานการจ่ายรายเดือน (ฝ่ายบัญชี) เป็นไฟล์ Excel — แยกส่วน ค่าอินเทอร์เน็ต / ค่าโทรศัพท์
// แต่ละส่วนมีรวมย่อย แล้วรวมทั้งสิ้นท้ายตาราง; พิมพ์ A4 แนวนอนพอดีความกว้าง

export type PaymentRow = {
  paidDate: ISODate;
  kind: ServiceKind;
  centerName: string; // ชื่อศูนย์ / ผู้ใช้บริการของเบอร์
  customerCode: string; // รหัสลูกค้า / เบอร์แบบมีขีด
  invoiceNo: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  dueDate: ISODate;
  amount: AmountInput;
  paymentRef: string;
  approverName: string | null;
};

const SECTIONS: { kind: ServiceKind; label: string }[] = [
  { kind: "INTERNET", label: "ค่าอินเทอร์เน็ต" },
  { kind: "PHONE", label: "ค่าโทรศัพท์" },
];

// หัวคอลัมน์ + ความกว้าง (หน่วยตัวอักษร)
const COLUMNS = [
  { title: "ลำดับ", width: 7 },
  { title: "วันที่จ่าย", width: 12 },
  { title: "ศูนย์ / ผู้ใช้บริการ", width: 28 },
  { title: "รหัสลูกค้า / เบอร์", width: 18 },
  { title: "เลขที่ใบแจ้งหนี้", width: 21 },
  { title: "รอบบริการ", width: 24 },
  { title: "ครบกำหนดชำระ", width: 15 },
  { title: "ยอด (บาท)", width: 15 },
  { title: "เลขอ้างอิงการจ่าย", width: 19 },
  { title: "ผู้อนุมัติ", width: 24 },
];
const WIDTH = COLUMNS.length;
const AMOUNT_COL = COLUMNS.findIndex((c) => c.title === "ยอด (บาท)");
export const HEADER_ROW = 4; // แถวที่ 4 = หัวตาราง (ตรึงไว้ตอนเลื่อน + พิมพ์ซ้ำทุกหน้า)

// แถวรวม: ข้อความคลุมตั้งแต่ลำดับถึงครบกำหนด ชิดขวา + ยอด + ช่องว่างที่เหลือ
function totalRow(label: string, satang: bigint, style: CellStyle): Row {
  const after = WIDTH - AMOUNT_COL - 1;
  return spanRow(text(label, { ...style, align: "right" }), AMOUNT_COL, [
    amount(satang, style),
    ...Array.from({ length: after }, () => text("", style)),
  ]);
}

export function paymentsSheet(month: string, rows: PaymentRow[], generatedAt: string): SheetData {
  const first: ISODate = `${month}-01`;
  const monthLabel = `${thaiMonthName(first)} ${beYear(first)}`;

  const data: SheetData = [
    spanRow(text(`สรุปการจ่ายค่าบริการ เดือน${monthLabel}`, titleStyle), WIDTH),
    spanRow(text(`บริษัท น้ำตาลสุรินทร์ จำกัด · นับตามวันที่จ่าย · ออกรายงาน ${generatedAt}`, noteStyle), WIDTH),
    [],
    COLUMNS.map((c) => text(c.title, { ...headerStyle, height: 26 })),
  ];

  let grandTotal = BigInt(0);
  let grandCount = 0;

  for (const section of SECTIONS) {
    const items = rows.filter((r) => r.kind === section.kind);
    if (items.length === 0) continue;

    data.push(spanRow(text(section.label, { fontWeight: "bold", textColor: COLOR.brand, backgroundColor: COLOR.brandLight, ...border }), WIDTH));

    let subtotal = BigInt(0);
    items.forEach((r, i) => {
      const satang = toSatang(r.amount);
      subtotal += satang;
      const style = { ...border, alignVertical: "center" as const, ...(i % 2 === 1 ? { backgroundColor: COLOR.stripe } : {}) };
      data.push([
        { type: Number, value: i + 1, align: "center", ...style },
        text(formatBEDate(r.paidDate), { ...style, align: "center" }),
        text(r.centerName, style),
        text(r.customerCode, style),
        text(r.invoiceNo, style),
        text(`${formatBEDate(r.periodStart)} – ${formatBEDate(r.periodEnd)}`, { ...style, align: "center" }),
        text(formatBEDate(r.dueDate), { ...style, align: "center" }),
        amount(satang, style),
        text(r.paymentRef, style),
        text(r.approverName ?? "", style),
      ]);
    });

    data.push(totalRow(`รวม${section.label} ${items.length} รายการ`, subtotal, { fontWeight: "bold", ...border }));
    grandTotal += subtotal;
    grandCount += items.length;
  }

  if (grandCount === 0) {
    data.push(spanRow(text(`ไม่มีการจ่ายในเดือน${monthLabel}`, { align: "center", textColor: COLOR.muted, height: 24, alignVertical: "center", ...border }), WIDTH));
  }

  data.push(
    totalRow(`รวมทั้งสิ้น ${grandCount} รายการ`, grandTotal, {
      fontWeight: "bold",
      backgroundColor: COLOR.brandLight,
      ...border,
      bottomBorderStyle: "double",
      height: 22,
      alignVertical: "center",
    }),
  );
  return data;
}

// ชื่อชีต ≤ 31 ตัวอักษร ห้าม : \ / ? * [ ]
export const paymentsSheetName = (month: string) => {
  const first: ISODate = `${month}-01`;
  return `การจ่าย ${thaiMonthName(first)} ${beYear(first)}`;
};

export function paymentsSheetOptions(month: string): SheetOptions<FileContent> {
  return {
    sheet: paymentsSheetName(month),
    columns: COLUMNS.map((c) => ({ width: c.width })),
    stickyRowsCount: HEADER_ROW,
    orientation: "landscape",
    showGridLines: false,
  };
}

export const paymentsPrintSetup = (month: string) =>
  printSetup({ sheetName: paymentsSheetName(month), titleRows: [HEADER_ROW, HEADER_ROW], fitToWidth: true });

export const paymentsFileName = (month: string) => `สรุปการจ่าย-${beYear(`${month}-01`)}-${month.slice(5, 7)}.xlsx`;
