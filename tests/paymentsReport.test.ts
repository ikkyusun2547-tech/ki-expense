import { unzipSync, strFromU8 } from "fflate"; // มากับ write-excel-file
import writeExcelFile, { type CellObject, type Row } from "write-excel-file/node";
import { describe, expect, it } from "vitest";
import {
  HEADER_ROW,
  paymentsFileName,
  paymentsSheet,
  paymentsSheetName,
  paymentsPrintSetup,
  paymentsSheetOptions,
  type PaymentRow,
} from "@/lib/reports/paymentsReport";

const row = (extra: Partial<PaymentRow> = {}): PaymentRow => ({
  paidDate: "2026-10-20",
  kind: "INTERNET",
  centerName: "ศูนย์ท่าตูม",
  customerCode: "600197701",
  invoiceNo: "3BB-6909-10071",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  dueDate: "2026-10-05",
  amount: "1068.93",
  paymentRef: "PV-001",
  approverName: "ผู้อนุมัติ ทดสอบ",
  ...extra,
});

const STAMP = "28 ต.ค. 2569 10:15 น.";
// ค่าในแต่ละช่องของแถว (ช่องที่ถูกคลุม = null)
const values = (r: Row) => r.map((c) => (c && typeof c === "object" ? (c as CellObject).value : c ?? null));
const firstText = (r: Row) => values(r)[0];

describe("paymentsSheet", () => {
  const sheet = paymentsSheet(
    "2026-10",
    [
      row(),
      row({ kind: "PHONE", centerName: "รัฐกิจสัมพันธ์", customerCode: "097-3378822", amount: "631.30", paymentRef: "", approverName: null }),
      row({ paidDate: "2026-10-25", amount: "749" }),
    ],
    STAMP,
  );

  it("หัวรายงาน: ชื่อเดือน พ.ศ. + เวลาออกรายงาน แล้วหัวตารางที่แถว HEADER_ROW", () => {
    expect(firstText(sheet[0])).toBe("สรุปการจ่ายค่าบริการ เดือนตุลาคม 2569");
    expect(firstText(sheet[1])).toContain(STAMP);
    expect(values(sheet[HEADER_ROW - 1])).toEqual([
      "ลำดับ",
      "วันที่จ่าย",
      "ศูนย์ / ผู้ใช้บริการ",
      "รหัสลูกค้า / เบอร์",
      "เลขที่ใบแจ้งหนี้",
      "รอบบริการ",
      "ครบกำหนดชำระ",
      "ยอด (บาท)",
      "เลขอ้างอิงการจ่าย",
      "ผู้อนุมัติ",
    ]);
  });

  it("แยกส่วนอินเทอร์เน็ต/โทรศัพท์ ลำดับเริ่มใหม่ทุกส่วน มีรวมย่อย แล้วรวมทั้งสิ้น (รวมเป็นสตางค์)", () => {
    const body = sheet.slice(HEADER_ROW).map(values);
    expect(body).toEqual([
      ["ค่าอินเทอร์เน็ต", ...Array(9).fill(null)],
      [1, "20/10/2569", "ศูนย์ท่าตูม", "600197701", "3BB-6909-10071", "01/09/2569 – 30/09/2569", "05/10/2569", 1068.93, "PV-001", "ผู้อนุมัติ ทดสอบ"],
      [2, "25/10/2569", "ศูนย์ท่าตูม", "600197701", "3BB-6909-10071", "01/09/2569 – 30/09/2569", "05/10/2569", 749, "PV-001", "ผู้อนุมัติ ทดสอบ"],
      ["รวมค่าอินเทอร์เน็ต 2 รายการ", ...Array(6).fill(null), 1817.93, "", ""],
      ["ค่าโทรศัพท์", ...Array(9).fill(null)],
      [1, "20/10/2569", "รัฐกิจสัมพันธ์", "097-3378822", "3BB-6909-10071", "01/09/2569 – 30/09/2569", "05/10/2569", 631.3, "", ""],
      ["รวมค่าโทรศัพท์ 1 รายการ", ...Array(6).fill(null), 631.3, "", ""],
      ["รวมทั้งสิ้น 3 รายการ", ...Array(6).fill(null), 2449.23, "", ""],
    ]);
  });

  it("ยอดเป็นตัวเลขรูปแบบ 1,234.56; รหัส/เบอร์เป็นข้อความ (Excel ไม่ตัด 0 ข้างหน้า)", () => {
    const [, first] = sheet.slice(HEADER_ROW);
    expect(first[7]).toMatchObject({ type: Number, format: "#,##0.00" });
    expect(first[3]).toMatchObject({ type: String, format: "@" });
  });

  it("ไม่มีการจ่าย → แจ้งในตาราง + รวมทั้งสิ้น 0", () => {
    const empty = paymentsSheet("2026-11", [], STAMP).slice(HEADER_ROW).map(values);
    expect(empty.map((r) => r[0])).toEqual(["ไม่มีการจ่ายในเดือนพฤศจิกายน 2569", "รวมทั้งสิ้น 0 รายการ"]);
    expect(empty[1][7]).toBe(0);
  });

  it("ชื่อชีตไม่เกิน 31 ตัวอักษร (ข้อจำกัด Excel) และชื่อไฟล์ .xlsx ปี พ.ศ.", () => {
    for (let m = 1; m <= 12; m++) expect(paymentsSheetName(`2026-${String(m).padStart(2, "0")}`).length).toBeLessThanOrEqual(31);
    expect(paymentsFileName("2026-10")).toBe("สรุปการจ่าย-2569-10.xlsx");
  });
});

describe("ไฟล์ .xlsx", () => {
  it("ตั้งค่าพิมพ์: พอดีความกว้าง A4 แนวนอน + พิมพ์หัวตารางซ้ำทุกหน้า + ตรึงหัวตาราง", async () => {
    const name = paymentsSheetName("2026-10");
    const file = await writeExcelFile(paymentsSheet("2026-10", [row()], STAMP), paymentsSheetOptions("2026-10"), {
      features: [paymentsPrintSetup("2026-10")],
    }).toBuffer();
    const files = unzipSync(new Uint8Array(file));
    const sheetXml = strFromU8(files["xl/worksheets/sheet1.xml"]);
    const workbookXml = strFromU8(files["xl/workbook.xml"]);

    expect(sheetXml.match(/<sheetPr>/g)).toHaveLength(1); // ต้องเป็นลูกตัวแรกของ worksheet และมีตัวเดียว
    expect(sheetXml).toMatch(/<worksheet\b[^>]*><sheetPr><pageSetUpPr fitToPage="1"\/><\/sheetPr>/);
    const pageSetup = sheetXml.match(/<pageSetup [^>]*\/>/)![0];
    expect(pageSetup).toContain('fitToWidth="1" fitToHeight="0"');
    expect(pageSetup).toContain('orientation="landscape"');
    expect(pageSetup.match(/paperSize="9"/g)).toHaveLength(1); // A4 จากไลบรารี — attribute ซ้ำ = ไฟล์เสีย
    expect(sheetXml).toContain(`ySplit="${HEADER_ROW}"`);
    expect(workbookXml).toContain(`<definedName name="_xlnm.Print_Titles" localSheetId="0">'${name}'!$4:$4</definedName>`);
    expect(workbookXml.match(/<definedNames/g)).toHaveLength(1); // element ซ้ำ = ไฟล์เสีย
    expect(workbookXml.indexOf("</sheets>")).toBeLessThan(workbookXml.indexOf("<definedNames>"));
  });
});
