import type { Blob } from "node:buffer";
import type { Stream } from "node:stream";
import type { CellObject, Feature, Row } from "write-excel-file/node";

// ชิ้นส่วนร่วมของรายงาน Excel (.xlsx) ที่ดาวน์โหลดจากเว็บ — สี/เส้น/ชนิดเซลล์/ตั้งค่าพิมพ์ให้เหมือนกันทุกรายงาน
// - ยอดเป็นตัวเลขจริง (รูปแบบ 1,234.56) รวมด้วย BigInt สตางค์ แล้วเขียนเป็นค่า ไม่ใช้สูตร
//   (ไฟล์ที่ดาวน์โหลดเปิดใน Protected View ซึ่ง Excel ไม่คำนวณสูตร — ยอดรวมจะว่าง)
// - วันที่เป็นข้อความ พ.ศ. แบบเดียวกับใบเบิก

// ชนิดไฟล์ของ write-excel-file/node (ไลบรารีไม่ export ชนิดนี้)
export type FileContent = Stream | Buffer | Blob;
export type CellStyle = Omit<CellObject, "value" | "type">;

// ฟอนต์ทั้งไฟล์: Tahoma มีในทุกเครื่อง Windows และแสดงภาษาไทยชัด
export const WORKBOOK_FONT = { fontFamily: "Tahoma", fontSize: 10 } as const;

export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// สีตามธีมของเว็บ (กรมท่า)
export const COLOR = {
  brand: "#1D2B45",
  brandLight: "#E3E9F3",
  stripe: "#F5F7FA",
  border: "#C7D3E7",
  muted: "#64748B",
  pending: "#FEF3C7", // ยังไม่จ่าย (amber-100)
  inactive: "#94A3B8", // ศูนย์ที่ย้าย/ปิด
};

export const border = { borderStyle: "thin", borderColor: COLOR.border } as const;

export const titleStyle: CellStyle = { fontWeight: "bold", fontSize: 16, textColor: COLOR.brand, height: 30, alignVertical: "center" };
export const noteStyle: CellStyle = { textColor: COLOR.muted };
export const headerStyle: CellStyle = {
  fontWeight: "bold",
  textColor: "#FFFFFF",
  backgroundColor: COLOR.brand,
  align: "center",
  alignVertical: "center",
  wrap: true,
  ...border,
};

export const text = (value: string, style: CellStyle = {}): CellObject => ({
  type: String,
  format: "@", // ข้อความ — กัน Excel แปลงรหัส/เบอร์เป็นตัวเลข (ตัด 0 ข้างหน้า)
  value,
  ...style,
});

// สตางค์ → ตัวเลขบาทสำหรับเซลล์ Excel (รวมยอดเป็น BigInt แล้ว แปลงครั้งเดียวตอนเขียน)
const baht = (satang: bigint) => Number(`${satang / BigInt(100)}.${String(satang % BigInt(100)).padStart(2, "0")}`);

export const amount = (satang: bigint, style: CellStyle = {}): CellObject => ({
  type: Number,
  format: "#,##0.00",
  value: baht(satang),
  align: "right",
  ...style,
});

// แถวที่เซลล์แรกคลุมหลายคอลัมน์ (ช่องที่ถูกคลุมต้องเป็น null)
export function spanRow(first: CellObject, span: number, rest: Row = []): Row {
  return [{ ...first, columnSpan: span }, ...Array<null>(span - 1).fill(null), ...rest];
}

// ตั้งค่าพิมพ์ (A4 แนวนอนตั้งใน SheetOptions): พิมพ์หัวตารางซ้ำทุกหน้า (+ คอลัมน์ซ้ายซ้ำ) และย่อพอดีความกว้างกระดาษได้
// write-excel-file ไม่มีตัวเลือกนี้ จึงแก้ XML ของชีต/สมุดงานเอง — ไลบรารีใส่ paperSize="9" (A4) และ <definedNames/> ว่างไว้แล้ว
// ห้ามใส่ซ้ำ (attribute/element ซ้ำ = Excel แจ้งไฟล์เสีย; มี test ตรวจ)
export function printSetup(opts: {
  sheetName: string;
  titleRows: [number, number]; // แถวหัวตาราง (เริ่ม 1)
  titleColumns?: string; // เช่น "A:D" = พิมพ์คอลัมน์ชื่อศูนย์ซ้ำทุกหน้า
  fitToWidth?: boolean; // ย่อให้กว้างพอดี 1 หน้า (สูงกี่หน้าก็ได้)
}): Feature<FileContent> {
  const sheet = `'${opts.sheetName.replace(/'/g, "''")}'`;
  const [from, to] = opts.titleRows;
  const titles = [
    opts.titleColumns ? `${sheet}!${opts.titleColumns.replace(/(\w+):(\w+)/, "$$$1:$$$2")}` : null,
    `${sheet}!$${from}:$${to}`,
  ].filter(Boolean);

  return {
    files: {
      transform: {
        "xl/worksheets/sheet{id}.xml": {
          transform: (xml) =>
            opts.fitToWidth
              ? xml
                  .replace(/(<worksheet\b[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>')
                  .replace("<pageSetup ", '<pageSetup fitToWidth="1" fitToHeight="0" ')
              : xml,
        },
        "xl/workbook.xml": {
          transform: (xml) =>
            xml.replace(
              "<definedNames/>",
              `<definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">${titles.join(",")}</definedName></definedNames>`,
            ),
        },
      },
    },
  };
}
