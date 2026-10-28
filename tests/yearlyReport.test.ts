import { unzipSync, strFromU8 } from "fflate"; // มากับ write-excel-file
import writeExcelFile, { type CellObject, type Row } from "write-excel-file/node";
import { describe, expect, it } from "vitest";
import {
  YEARLY_HEADER_ROWS,
  yearlyFileName,
  yearlyPrintSetup,
  yearlyReport,
  yearlySheetName,
  type YearlyCenter,
  type YearlyRequest,
} from "@/lib/reports/yearlyReport";

const STAMP = "28 ต.ค. 2569 10:15 น.";
const values = (r: Row) => r.map((c) => (c && typeof c === "object" ? (c as CellObject).value : c ?? null));
const cellAt = (r: Row, i: number) => r[i] as CellObject;
// คอลัมน์ของเดือน (0 = ม.ค.): ลำดับ + 3 คอลัมน์ข้อมูลศูนย์ แล้วเดือนละ 3 ช่อง เริ่มที่เดือนแรกที่มีใบเบิก (first)
const monthCol = (m: number, first = 7) => 4 + (m - first) * 3;

const centers: YearlyCenter[] = [
  { id: "a", name: "ศูนย์โคกตะเคียน", code: "660662393", serviceNumber: "A211192000339", status: "ACTIVE" },
  { id: "b", name: "ศูนย์โนนคูณ", code: "660679565", serviceNumber: "A201059000026", status: "MOVED" },
];
const req = (extra: Partial<YearlyRequest>): YearlyRequest => ({
  centerId: "a",
  amount: "631.30",
  dueDate: "2026-09-24",
  periodStart: "2026-08-24",
  periodEnd: "2026-09-23",
  paid: true,
  ...extra,
});
const requests: YearlyRequest[] = [
  req({}),
  req({ dueDate: "2026-10-24", periodStart: "2026-09-24", periodEnd: "2026-10-23", paid: false }),
  req({ centerId: "b", amount: "749", dueDate: "2026-08-10", periodStart: "2026-07-10", periodEnd: "2026-08-09" }),
  req({ dueDate: "2025-12-24" }), // ปีอื่น — ไม่นับ
];

describe("yearlySheet", () => {
  const { sheet, options } = yearlyReport("INTERNET", 2026, centers, requests, STAMP);
  const [rowA, rowB, total] = sheet.slice(YEARLY_HEADER_ROWS[1]);

  it("หัว: ชื่อปี พ.ศ. + หัวตาราง 2 ชั้น (เดือน / ค่าบริการ กำหนดชำระ รอบค่าบริการ) แบบกระดาษ เริ่มเดือนแรกที่มีใบเบิก", () => {
    expect(values(sheet[0])[0]).toBe("ค่าอินเทอร์เน็ต ปี 2569");
    expect(values(sheet[1])[0]).toContain("พื้นเหลือง = ยังไม่จ่าย");
    const top = sheet[YEARLY_HEADER_ROWS[0] - 1];
    expect(values(top).slice(0, 5)).toEqual(["ลำดับ", "ชื่อศูนย์", "หมายเลขบริการ", "รหัสลูกค้า", "สิงหาคม"]);
    expect(cellAt(top, monthCol(8))).toMatchObject({ value: "กันยายน", columnSpan: 3 });
    expect(values(top).at(-1)).toBe("รวมทั้งปี");
    expect(values(sheet[YEARLY_HEADER_ROWS[1] - 1]).slice(4, 7)).toEqual(["ค่าบริการ", "กำหนดชำระ", "รอบค่าบริการ"]);
  });

  it("ใบเบิกอยู่เดือนของวันครบกำหนด: ค่าบริการ / กำหนดชำระ พ.ศ. / รอบแบบย่อ; ปีอื่นไม่นับ", () => {
    expect(values(rowA).slice(0, 4)).toEqual([1, "ศูนย์โคกตะเคียน", "A211192000339", "660662393"]);
    expect(values(rowA).slice(monthCol(8), monthCol(8) + 3)).toEqual([631.3, "24/09/2569", "24/08/69-23/09/69"]);
    expect(values(rowA).slice(monthCol(11), monthCol(11) + 3)).toEqual(["", "", ""]); // ธ.ค. 2569 ว่าง (ใบ ธ.ค. 2568 อยู่ปีก่อน)
    expect(values(rowA).at(-1)).toBe(1262.6);
  });

  it("ยังไม่จ่าย = พื้นเหลือง; ศูนย์ที่ย้าย = ตัวเทา + เดือนหลังใบสุดท้ายเขียน ย้ายศูนย์", () => {
    expect(cellAt(rowA, monthCol(9)).backgroundColor).toBe("#FEF3C7");
    expect(cellAt(rowA, monthCol(8)).backgroundColor).toBeUndefined();
    expect(cellAt(rowB, 1).textColor).toBe("#94A3B8");
    expect(values(rowB)[monthCol(7)]).toBe(749); // ส.ค. = ใบสุดท้าย
    expect(cellAt(rowB, monthCol(8))).toMatchObject({ value: "ย้ายศูนย์", columnSpan: 3 });
    expect(values(rowA)[monthCol(7)]).toBe(""); // ศูนย์ที่ใช้งานอยู่ เดือนที่ไม่มีใบ = ว่าง
  });

  it("แถวรวม: ยอดต่อเดือน + รวมทั้งปี (คิดเป็นสตางค์)", () => {
    expect(values(total)[0]).toBe("รวม");
    expect(values(total)[monthCol(7)]).toBe(749);
    expect(values(total)[monthCol(8)]).toBe(631.3);
    expect(values(total).at(-1)).toBe(2011.6);
    // ทุกแถวกว้างเท่ากัน (ช่องที่ถูกคลุมเป็น null) — ไม่งั้นเส้นตารางเพี้ยน
    for (const r of [rowA, rowB, total]) expect(r).toHaveLength(4 + 5 * 3 + 1); // ส.ค.–ธ.ค.
    expect(options.columns).toHaveLength(4 + 5 * 3 + 1);
  });

  it("ปีที่ยังไม่มีใบเบิก → ครบ 12 เดือน ม.ค.–ธ.ค.", () => {
    const { sheet: empty } = yearlyReport("INTERNET", 2027, centers, requests, STAMP);
    expect(values(empty[3])[4]).toBe("มกราคม");
    expect(empty[5]).toHaveLength(4 + 36 + 1);
  });

  it("ค่าโทรศัพท์: คอลัมน์ ผู้ใช้บริการ / หมายเลขโทรศัพท์ / รหัสลูกค้า; ยกเลิก = ยกเลิก", () => {
    const { sheet: phone } = yearlyReport(
      "PHONE",
      2026,
      [{ id: "p", name: "รัฐกิจสัมพันธ์", code: "097-3378822", serviceNumber: "14102-02-61688800211", status: "CLOSED" }],
      [req({ centerId: "p", dueDate: "2026-09-24" })],
      STAMP,
    );
    expect(values(phone[0])[0]).toBe("ค่าโทรศัพท์ ปี 2569");
    expect(values(phone[3]).slice(1, 4)).toEqual(["ผู้ใช้บริการ", "หมายเลขโทรศัพท์", "รหัสลูกค้า"]);
    const row = phone[YEARLY_HEADER_ROWS[1]];
    expect(values(row).slice(1, 4)).toEqual(["รัฐกิจสัมพันธ์", "097-3378822", "14102-02-61688800211"]);
    expect(values(row)[monthCol(9, 8)]).toBe("ยกเลิก");
  });

  it("ชื่อชีต ≤ 31 ตัวอักษร; ชื่อไฟล์ปี พ.ศ.", () => {
    expect(yearlySheetName("INTERNET", 2026).length).toBeLessThanOrEqual(31);
    expect(yearlyFileName("PHONE", 2026)).toBe("ตารางรายปี-ค่าโทรศัพท์-2569.xlsx");
  });
});

describe("ไฟล์ .xlsx ตารางรายปี", () => {
  it("ตรึงหัว 2 แถว + คอลัมน์ชื่อ; พิมพ์หัวตารางและคอลัมน์ A:D ซ้ำทุกหน้า; ไม่ย่อพอดีหน้า", async () => {
    const report = yearlyReport("INTERNET", 2026, centers, requests, STAMP);
    const file = await writeExcelFile(report.sheet, report.options, {
      features: [yearlyPrintSetup("INTERNET", 2026)],
    }).toBuffer();
    const files = unzipSync(new Uint8Array(file));
    const sheetXml = strFromU8(files["xl/worksheets/sheet1.xml"]);
    const workbookXml = strFromU8(files["xl/workbook.xml"]);

    expect(sheetXml).toContain('ySplit="5"');
    expect(sheetXml).toContain('xSplit="4"');
    expect(sheetXml).not.toContain("fitToPage");
    expect(workbookXml.match(/<definedNames/g)).toHaveLength(1);
    expect(workbookXml).toContain(`<definedName name="_xlnm.Print_Titles" localSheetId="0">'ค่าอินเทอร์เน็ต 2569'!$A:$D,'ค่าอินเทอร์เน็ต 2569'!$4:$5</definedName>`);
    expect(sheetXml).toContain('<mergeCell ref="A4:A5"/>'); // ลำดับ คลุม 2 แถว
    expect(sheetXml).toContain('<mergeCell ref="E4:G4"/>'); // เดือนแรก คลุม 3 คอลัมน์
  });
});
