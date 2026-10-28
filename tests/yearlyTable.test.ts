import { readSheet } from "read-excel-file/node";
import writeExcelFile from "write-excel-file/node";
import { describe, expect, it } from "vitest";
import { parseTableDate, parseTablePeriod, parseYearlyTable, planBills, type TableBill } from "@/lib/centers/yearlyTable";
import { yearlyReport } from "@/lib/reports/yearlyReport";

// ตารางแบบกระดาษ "ค่าอินเตอร์เน็ต 3BB ปี 2569" (หัวตาราง 2 แถว, เดือนละ 3 ช่อง)
const HEAD = ["ลำดับ", "ชื่อ", "หมายเลขบริการ", "รหัสลูกค้า", "กันยายน", null, null, "ตุลาคม", null, null];
const SUB = [null, null, null, null, "ค่าบริการ", "กำหนดชำระ", "รอบค่าบริการ", "ค่าบริการ", "กำหนดชำระ", "รอบค่าบริการ"];
const paper = (...rows: unknown[][]) => [["ค่าอินเตอร์เน็ต 3BB ปี 2569"], [], HEAD, SUB, ...rows];

describe("parseTableDate / parseTablePeriod", () => {
  it("รับวันที่ พ.ศ. 4 หลัก / 2 หลัก / ค.ศ. / Date ของ Excel / เลขลำดับวันของ Excel", () => {
    expect(parseTableDate("24/09/2569")).toBe("2026-09-24");
    expect(parseTableDate("4/9/69")).toBe("2026-09-04");
    expect(parseTableDate("24/09/2026")).toBe("2026-09-24");
    expect(parseTableDate(new Date(Date.UTC(2026, 8, 24)))).toBe("2026-09-24");
    expect(parseTableDate(new Date(Date.UTC(2569, 8, 24)))).toBe("2026-09-24"); // Excel ที่ตีความปี พ.ศ. เป็น ค.ศ.
    expect(parseTableDate("46289")).toBe("2026-09-24");
    expect(parseTableDate("31/02/2569")).toBeNull();
    expect(parseTableDate("ย้ายศูนย์")).toBeNull();
  });

  it("รอบค่าบริการแบบที่เขียนในกระดาษ", () => {
    expect(parseTablePeriod("24/08/69-23/09/69")).toEqual({ start: "2026-08-24", end: "2026-09-23" });
    expect(parseTablePeriod("12/08/69 -11/09/69")).toEqual({ start: "2026-08-12", end: "2026-09-11" });
    expect(parseTablePeriod("24/08/2569 – 23/09/2569")).toEqual({ start: "2026-08-24", end: "2026-09-23" });
    expect(parseTablePeriod("24/08/69 ถึง 23/09/69")).toEqual({ start: "2026-08-24", end: "2026-09-23" });
    expect(parseTablePeriod("24/08/69")).toBeNull();
  });
});

describe("parseYearlyTable", () => {
  it("อ่านแถวศูนย์ + บิลแต่ละเดือน; ยอดปกติ/วันครบกำหนด = บิลล่าสุด; หยุดที่แถวรวม", () => {
    const result = parseYearlyTable(
      paper(
        ["1", "ศูนย์โคกตะเคียน", "A211192000339", "660662393", "631.30", "24/09/2569", "24/08/69-23/09/69", "631.3", "24/10/2569", "24/09/69-23/10/69"],
        [],
        ["2", "ศูนย์ปราสาท", "AAIS2511257888", "450313966", "642", "30/09/2569", "01/09/69-30/09/69", "", "", ""],
        ["", "รวม", "", "", "1273.30"],
        ["99", "ศูนย์หลังแถวรวม", "", "123", "1", "1/1/2569", "1/1/69-2/1/69"],
      ),
      "INTERNET",
    );
    expect(result.errors).toEqual([]);
    expect(result.centers).toEqual([
      { line: 5, customerCode: "660662393", serviceNumber: "A211192000339", name: "ศูนย์โคกตะเคียน", normalAmount: "631.30", dueDay: 24, status: null },
      { line: 7, customerCode: "450313966", serviceNumber: "AAIS2511257888", name: "ศูนย์ปราสาท", normalAmount: "642.00", dueDay: 30, status: null },
    ]);
    expect(result.bills.map((b) => [b.customerCode, b.month, b.amount, b.dueDate, b.periodStart, b.periodEnd])).toEqual([
      ["660662393", "กันยายน", "631.30", "2026-09-24", "2026-08-24", "2026-09-23"],
      ["660662393", "ตุลาคม", "631.30", "2026-10-24", "2026-09-24", "2026-10-23"],
      ["450313966", "กันยายน", "642.00", "2026-09-30", "2026-09-01", "2026-09-30"],
    ]);
  });

  it('"ย้ายศูนย์" ในช่องเดือน = สถานะย้าย; ยอดทศนิยมยาวจาก Excel ปัดเป็น 2 ตำแหน่ง', () => {
    const { centers, bills, errors } = parseYearlyTable(
      paper(["2", "ศูนย์โนนคูณ", "A201059000026", "660679565", "631.29999999999995", "16/09/2569", "16/08/69-15/09/69", "ย้ายศูนย์", null, null]),
      "INTERNET",
    );
    expect(errors).toEqual([]);
    expect(centers[0]).toMatchObject({ status: "MOVED", normalAmount: "631.30" });
    expect(bills).toHaveLength(1);
  });

  it("แจ้งทุกจุดที่ผิดพร้อมบรรทัดและเดือน; รหัสซ้ำในไฟล์", () => {
    const { errors } = parseYearlyTable(
      paper(
        ["1", "ศูนย์ ก", "", "111", "abc", "32/09/2569", "24/08/69", "", "", ""],
        ["2", "", "", "", "749", "", "", "", "", ""],
        ["3", "ศูนย์ ค", "", "111", "", "", "", "", "", ""],
        ["4", "ศูนย์ ง", "", "222", "749", "24/09/2569", "24/09/69-23/08/69", "", "", ""],
      ),
      "INTERNET",
    );
    expect(errors).toEqual([
      'บรรทัด 5 (ศูนย์ ก): เดือนกันยายน: ค่าบริการไม่ถูกต้อง "abc", เดือนกันยายน: กำหนดชำระไม่ถูกต้อง "32/09/2569" (ใช้ วว/ดด/ปปปป เช่น 24/09/2569), เดือนกันยายน: รอบค่าบริการไม่ถูกต้อง "24/08/69" (เช่น 24/08/69-23/09/69)',
      'บรรทัด 6: ไม่มีชื่อศูนย์, ไม่มีรหัสลูกค้า, เดือนกันยายน: กำหนดชำระไม่ถูกต้อง "" (ใช้ วว/ดด/ปปปป เช่น 24/09/2569), เดือนกันยายน: รอบค่าบริการไม่ถูกต้อง "" (เช่น 24/08/69-23/09/69)',
      "บรรทัด 8 (ศูนย์ ง): เดือนกันยายน: รอบค่าบริการวันสิ้นสุดก่อนวันเริ่ม",
    ]);
    // บรรทัด 7 รหัสซ้ำกับบรรทัด 5 — แต่บรรทัด 5 ผิดจึงยังไม่ถูกจำ; ทดสอบซ้ำแบบถูกต้อง
    const dup = parseYearlyTable(paper(["1", "ศูนย์ ก", "", "111"], ["2", "ศูนย์ ข", "", "111"]), "INTERNET");
    expect(dup.errors).toEqual(["บรรทัด 6 (ศูนย์ ข): รหัสลูกค้า 111 ซ้ำกับบรรทัด 5"]);
  });

  it("ค่าโทรศัพท์: เบอร์ที่ Excel ตัด 0 เติมให้; ยกเลิก = ปิด", () => {
    const head = ["ลำดับ", "ผู้ใช้บริการ", "หมายเลขโทรศัพท์", "รหัสลูกค้า", "กันยายน", null, null];
    const { centers, errors } = parseYearlyTable(
      [head, SUB.slice(0, 7), ["1", "รัฐกิจสัมพันธ์", "973378822", "14102-02-61688800211", "ยกเลิก", null, null]],
      "PHONE",
    );
    expect(errors).toEqual([]);
    expect(centers[0]).toMatchObject({ customerCode: "0973378822", serviceNumber: "14102-02-61688800211", status: "CLOSED", normalAmount: null });
  });

  it("ไม่ใช่ตารางรายปี → แจ้งให้ใช้แบบฟอร์มของระบบ", () => {
    expect(parseYearlyTable([["รหัสลูกค้า", "ชื่อศูนย์"]], "INTERNET").errors[0]).toContain("ไม่พบหัวตาราง");
  });
});

describe("planBills", () => {
  const bill = (start: string, end: string, code = "111"): TableBill => ({
    line: 1,
    month: "",
    customerCode: code,
    amount: "749.00",
    dueDate: end,
    periodStart: start,
    periodEnd: end,
  });

  it("ข้ามบิลที่รอบทับใบเดิม (รวมวันขอบ) หรือทับบิลก่อนหน้าในไฟล์", () => {
    const existing = new Map([["111", [{ start: "2026-09-24", end: "2026-10-23" }]]]);
    const a = bill("2026-08-24", "2026-09-23");
    const b = bill("2026-09-24", "2026-10-23"); // ซ้ำใบเดิม
    const c = bill("2026-10-23", "2026-11-22"); // ทับวันขอบ
    const d = bill("2026-08-24", "2026-09-23", "222");
    const e = bill("2026-09-01", "2026-09-30", "222"); // ทับบิล d ในไฟล์
    expect(planBills([a, b, c, d, e], existing)).toEqual({ create: [a, d], skipped: [e, b, c] });
  });
});

describe("แบบฟอร์มนำเข้า (ดาวน์โหลด → กรอก → อ่านกลับ)", () => {
  it("ไฟล์จาก yearlyReport template อ่านกลับได้ครบ (ศูนย์เดิม + ใบเดิม)", async () => {
    const { sheet, options } = yearlyReport(
      "INTERNET",
      2026,
      [{ id: "a", name: "ศูนย์โคกตะเคียน", code: "660662393", serviceNumber: "A211192000339", status: "ACTIVE" }],
      [{ centerId: "a", amount: "631.30", dueDate: "2026-09-24", periodStart: "2026-08-24", periodEnd: "2026-09-23", paid: true }],
      "",
      { template: true },
    );
    const file = await writeExcelFile(sheet, options).toBuffer();
    const data = await readSheet(file, { parseNumber: (s: string) => s });
    const { centers, bills, errors } = parseYearlyTable(data, "INTERNET");

    expect(errors).toEqual([]);
    expect(centers).toEqual([
      { line: 6, customerCode: "660662393", serviceNumber: "A211192000339", name: "ศูนย์โคกตะเคียน", normalAmount: "631.30", dueDay: 24, status: null },
    ]);
    expect(bills).toMatchObject([{ month: "กันยายน", amount: "631.30", dueDate: "2026-09-24", periodStart: "2026-08-24", periodEnd: "2026-09-23" }]);
  });
});
