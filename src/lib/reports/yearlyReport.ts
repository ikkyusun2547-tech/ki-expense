import type { CellObject, Row, SheetData, SheetOptions } from "write-excel-file/node";
import type { CenterStatus, ServiceKind } from "@/generated/prisma/enums";
import { toSatang, type AmountInput } from "@/lib/money";
import { formatBEDate, type ISODate } from "@/lib/thai/date";
import { amount, border, COLOR, headerStyle, noteStyle, printSetup, spanRow, text, titleStyle, type CellStyle, type FileContent } from "./xlsx";

// ตารางรายปี (แทนตารางสรุปที่เคยเขียนมือ): 1 แถว = 1 ศูนย์/เบอร์, แต่ละเดือนมี ค่าบริการ / กำหนดชำระ / รอบค่าบริการ
// - ใบเบิกอยู่เดือนไหน = เดือนของวันครบกำหนดชำระ (กฎเดียวกับหน้าสรุปรายศูนย์)
// - ใบที่ยังไม่จ่าย (สร้างแล้ว/รออนุมัติ/อนุมัติแล้ว) พื้นเหลือง; ศูนย์ที่ย้าย/ปิด ตัวอักษรเทา + เดือนหลังใบสุดท้ายเขียน "ย้ายศูนย์"/"ปิด"
// - เริ่มคอลัมน์ที่เดือนแรกที่มีใบเบิกในปีนั้น (ปีที่เริ่มใช้ระบบกลางปี ไม่ต้องมีเดือนว่างยาว) ถึงธันวาคม
// - เรียงแถวตามที่ส่งมา (route เรียงตามลำดับที่เพิ่มเข้าทะเบียน = ลำดับเดิมในกระดาษเมื่อนำเข้า)

export type YearlyCenter = {
  id: string;
  name: string; // ชื่อศูนย์ / ผู้ใช้บริการ
  code: string; // รหัสลูกค้า / เบอร์แบบมีขีด
  serviceNumber: string | null; // หมายเลขบริการ / รหัสลูกค้าของค่าย
  status: CenterStatus;
};

export type YearlyRequest = {
  centerId: string;
  amount: AmountInput;
  dueDate: ISODate;
  periodStart: ISODate;
  periodEnd: ISODate;
  paid: boolean;
};

const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

// คอลัมน์ซ้าย (ตรึงไว้ + พิมพ์ซ้ำทุกหน้า) ตามกระดาษ: ลำดับ / ชื่อ / หมายเลขบริการ / รหัสลูกค้า
const FIXED: Record<ServiceKind, { title: string; width: number; value: (c: YearlyCenter) => string }[]> = {
  INTERNET: [
    { title: "ชื่อศูนย์", width: 30, value: (c) => c.name },
    { title: "หมายเลขบริการ", width: 18, value: (c) => c.serviceNumber ?? "" },
    { title: "รหัสลูกค้า", width: 12, value: (c) => c.code },
  ],
  PHONE: [
    { title: "ผู้ใช้บริการ", width: 26, value: (c) => c.name },
    { title: "หมายเลขโทรศัพท์", width: 15, value: (c) => c.code },
    { title: "รหัสลูกค้า", width: 20, value: (c) => c.serviceNumber ?? "" },
  ],
};
const FIXED_COUNT = 4; // ลำดับ + 3 คอลัมน์ข้างบน
const MONTH_COLUMNS = [
  { title: "ค่าบริการ", width: 11 },
  { title: "กำหนดชำระ", width: 12 },
  { title: "รอบค่าบริการ", width: 19 },
];
export const YEARLY_HEADER_ROWS: [number, number] = [4, 5];

const KIND_LABEL: Record<ServiceKind, string> = { INTERNET: "ค่าอินเทอร์เน็ต", PHONE: "ค่าโทรศัพท์" };
const INACTIVE_LABEL: Record<ServiceKind, Partial<Record<CenterStatus, string>>> = {
  INTERNET: { MOVED: "ย้ายศูนย์", CLOSED: "ปิด" },
  PHONE: { CLOSED: "ยกเลิก" },
};

// "24/08/69-23/09/69" แบบที่เขียนในกระดาษ
const shortBE = (iso: ISODate) => formatBEDate(iso).replace(/\/\d\d(\d\d)$/, "/$1");
const periodText = (r: YearlyRequest) => `${shortBE(r.periodStart)}-${shortBE(r.periodEnd)}`;
const monthOf = (iso: ISODate) => Number(iso.slice(5, 7)) - 1;

export type YearlyReport = { sheet: SheetData; options: SheetOptions<FileContent> };

// template = แบบฟอร์มให้กรอกจากกระดาษแล้วนำเข้า (admin): ครบ 12 เดือน + แถวว่างให้กรอก + คำแนะนำ ไม่มีแถวรวม
const TEMPLATE_BLANK_ROWS = 30;
const TEMPLATE_NOTE: Record<ServiceKind, string> = {
  INTERNET:
    'กรอกตามตารางเดิม: ค่าบริการ / กำหนดชำระ (เช่น 24/09/2569) / รอบค่าบริการ (เช่น 24/08/69-23/09/69) · ศูนย์ที่ย้ายแล้วเขียน "ย้ายศูนย์" ในช่องเดือน · เสร็จแล้วนำเข้าที่ ทะเบียนศูนย์ → นำเข้าจากไฟล์',
  PHONE:
    'กรอกตามตารางเดิม: ค่าบริการ / กำหนดชำระ (เช่น 24/09/2569) / รอบค่าบริการ (เช่น 16/08/69-15/09/69) · เบอร์ที่ยกเลิกแล้วเขียน "ยกเลิก" ในช่องเดือน · เสร็จแล้วนำเข้าที่ ทะเบียนเบอร์โทร → นำเข้าจากไฟล์',
};

export function yearlyReport(
  kind: ServiceKind,
  year: number,
  centers: YearlyCenter[],
  allRequests: YearlyRequest[],
  generatedAt: string,
  { template = false }: { template?: boolean } = {},
): YearlyReport {
  const requests = allRequests.filter((r) => Number(r.dueDate.slice(0, 4)) === year);
  const firstMonth = requests.length && !template ? Math.min(...requests.map((r) => monthOf(r.dueDate))) : 0;
  const months = MONTHS.slice(firstMonth);
  const width = FIXED_COUNT + months.length * MONTH_COLUMNS.length + 1;

  const byCenter = new Map<string, YearlyRequest[][]>();
  for (const r of requests) {
    const cells = byCenter.get(r.centerId) ?? months.map(() => []);
    cells[monthOf(r.dueDate) - firstMonth].push(r);
    byCenter.set(r.centerId, cells);
  }

  const header = (value: string, style: CellStyle = {}) => text(value, { ...headerStyle, ...style });
  const data: SheetData = [
    spanRow(text(`${KIND_LABEL[kind]} ปี ${year + 543}`, titleStyle), width),
    spanRow(
      text(
        template
          ? TEMPLATE_NOTE[kind]
          : `บริษัท น้ำตาลสุรินทร์ จำกัด · เดือนตามวันครบกำหนดชำระ · พื้นเหลือง = ยังไม่จ่าย · ออกรายงาน ${generatedAt}`,
        noteStyle,
      ),
      width,
    ),
    [],
    [
      header("ลำดับ", { rowSpan: 2 }),
      ...FIXED[kind].map((c) => header(c.title, { rowSpan: 2 })),
      ...months.flatMap((m) => [header(m, { columnSpan: MONTH_COLUMNS.length, height: 20 }), null, null]),
      header("รวมทั้งปี", { rowSpan: 2 }),
    ],
    [...Array<null>(FIXED_COUNT).fill(null), ...months.flatMap(() => MONTH_COLUMNS.map((c) => header(c.title))), null],
  ];

  const monthTotals = months.map(() => BigInt(0));
  let yearTotal = BigInt(0);

  centers.forEach((center, i) => {
    const cells = byCenter.get(center.id) ?? months.map(() => []);
    const inactive = INACTIVE_LABEL[kind][center.status];
    const lastMonth = cells.findLastIndex((m) => m.length > 0);
    const base: CellStyle = {
      ...border,
      alignVertical: "center",
      ...(i % 2 === 1 ? { backgroundColor: COLOR.stripe } : {}),
      ...(inactive ? { textColor: COLOR.inactive } : {}),
    };

    let rowTotal = BigInt(0);
    const row: Row = [
      { type: Number, value: i + 1, align: "center", ...base },
      ...FIXED[kind].map((c) => text(c.value(center), base)),
    ];
    cells.forEach((items, m) => {
      if (items.length === 0) {
        row.push(
          ...(inactive && m > lastMonth
            ? [text(inactive, { ...base, columnSpan: MONTH_COLUMNS.length, align: "center" }), null, null]
            : MONTH_COLUMNS.map(() => text("", base))),
        );
        return;
      }
      const satang = items.reduce((sum, r) => sum + toSatang(r.amount), BigInt(0));
      monthTotals[m] += satang;
      rowTotal += satang;
      // ใบเดียวกันเดือนเดียวกันเกิน 1 ใบ (ไม่ค่อยเกิด) — รวมยอด แสดงวันที่/รอบทุกใบ
      const style: CellStyle = { ...base, ...(items.some((r) => !r.paid) ? { backgroundColor: COLOR.pending } : {}), wrap: items.length > 1 };
      row.push(
        amount(satang, style),
        text(items.map((r) => formatBEDate(r.dueDate)).join("\n"), { ...style, align: "center" }),
        text(items.map(periodText).join("\n"), { ...style, align: "center" }),
      );
    });
    yearTotal += rowTotal;
    row.push(rowTotal > BigInt(0) ? amount(rowTotal, { ...base, fontWeight: "bold" }) : text("", base));
    data.push(row);
  });

  if (template) {
    // แถวว่างให้กรอกศูนย์ใหม่ (ช่องเป็นข้อความ — Excel ไม่แปลงวันที่/รหัสเอง)
    for (let i = 0; i < TEMPLATE_BLANK_ROWS; i++) data.push(Array.from({ length: width }, () => text("", border)));
    return { sheet: data, options: sheetOptions(kind, year, months.length) };
  }

  if (centers.length === 0) {
    data.push(spanRow(text(`ยังไม่มี${kind === "PHONE" ? "เบอร์" : "ศูนย์"}ในทะเบียน`, { ...border, align: "center", textColor: COLOR.muted }), width));
  }

  const totalStyle: CellStyle = { ...border, fontWeight: "bold", backgroundColor: COLOR.brandLight, bottomBorderStyle: "double", height: 22, alignVertical: "center" };
  data.push(
    spanRow(text("รวม", { ...totalStyle, align: "center" }), FIXED_COUNT, [
      ...monthTotals.flatMap((t): CellObject[] => [
        t > BigInt(0) ? amount(t, totalStyle) : text("", totalStyle),
        text("", totalStyle),
        text("", totalStyle),
      ]),
      amount(yearTotal, totalStyle),
    ]),
  );

  return { sheet: data, options: sheetOptions(kind, year, months.length) };
}

function sheetOptions(kind: ServiceKind, year: number, monthCount: number): SheetOptions<FileContent> {
  return {
    sheet: yearlySheetName(kind, year),
    columns: [
      { width: 7 },
      ...FIXED[kind].map((c) => ({ width: c.width })),
      ...Array.from({ length: monthCount }).flatMap(() => MONTH_COLUMNS.map((c) => ({ width: c.width }))),
      { width: 13 },
    ],
    stickyRowsCount: YEARLY_HEADER_ROWS[1],
    stickyColumnsCount: FIXED_COUNT,
    orientation: "landscape",
    showGridLines: false,
  };
}

// ชื่อชีต ≤ 31 ตัวอักษร
export const yearlySheetName = (kind: ServiceKind, year: number) => `${KIND_LABEL[kind]} ${year + 543}`;

// พิมพ์: ตารางกว้างหลายเดือน จึงไม่ย่อพอดีหน้า — แบ่งหลายหน้าตามความกว้าง โดยพิมพ์หัวตาราง + คอลัมน์ชื่อซ้ำทุกหน้า
export const yearlyPrintSetup = (kind: ServiceKind, year: number) =>
  printSetup({ sheetName: yearlySheetName(kind, year), titleRows: YEARLY_HEADER_ROWS, titleColumns: "A:D" });

export const yearlyFileName = (kind: ServiceKind, year: number, template = false) =>
  `${template ? "แบบฟอร์มนำเข้า" : "ตารางรายปี"}-${KIND_LABEL[kind]}-${year + 543}.xlsx`;
