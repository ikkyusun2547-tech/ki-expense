import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "@/lib/centers/phone";
import { parsePhonesCsv } from "@/lib/centers/phoneCsv";
import { centerStatusLabel } from "@/lib/status";
import { phoneSchema } from "@/lib/validation";

describe("normalizePhone", () => {
  it.each([
    ["097-3378822", "0973378822"],
    ["097 337 8822", "0973378822"],
    ["+66 97 337 8822", "0973378822"],
    ["66973378822", "0973378822"],
    ["973378822", "0973378822"], // Excel ตัด 0 ตัวหน้า
    ["02-123-4567", "021234567"],
    ["44123456", "044123456"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "abc", "12345", "09733788221", "097-337-882x"])("ไม่ใช่เบอร์: %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("มือถือ 3-7 ตามฟอร์มบันทึกภายใน, เบอร์บ้าน 2-7 / 3-6", () => {
    expect(formatPhone("0973378822")).toBe("097-3378822");
    expect(formatPhone("021234567")).toBe("02-1234567");
    expect(formatPhone("044123456")).toBe("044-123456");
    expect(formatPhone("abc")).toBe("abc");
  });
});

describe("phoneSchema", () => {
  const base = {
    phoneNumber: "097-3378822",
    provider: "true",
    accountCode: "",
    name: "รัฐกิจสัมพันธ์",
    normalAmount: "374.50",
    dueDay: "9",
    status: "ACTIVE",
  };

  it("เก็บเบอร์เป็นตัวเลขล้วน และระบบเป็นตัวพิมพ์ใหญ่", () => {
    expect(phoneSchema.parse(base)).toEqual({
      ...base,
      phoneNumber: "0973378822",
      provider: "TRUE",
      accountCode: null,
      dueDay: 9,
      normalAmount: "374.50",
    });
  });

  it("เบอร์ผิด / สถานะ ย้าย ใช้ไม่ได้", () => {
    const result = phoneSchema.safeParse({ ...base, phoneNumber: "12", status: "MOVED" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(["phoneNumber", "status"]);
  });
});

describe("parsePhonesCsv", () => {
  const HEADER = "หมายเลขโทรศัพท์,ระบบ,ผู้ใช้บริการ,ยอดปกติ,วันครบกำหนด,รหัสลูกค้า,สถานะ";

  it("อ่านแถวปกติ: ระบบว่าง = TRUE, สถานะ ยกเลิก = CLOSED, เติม 0 ที่ Excel ตัดทิ้ง", () => {
    const { rows, errors } = parsePhonesCsv(
      [HEADER, "097-3378822,true,รัฐกิจสัมพันธ์,374.50,9,24391360,", "812345678,,บัญชี,299,15,,ยกเลิก"].join("\n"),
    );
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        kind: "PHONE",
        customerCode: "0973378822",
        serviceNumber: "24391360",
        provider: "TRUE",
        name: "รัฐกิจสัมพันธ์",
        normalAmount: "374.50",
        dueDay: 9,
        status: "ACTIVE",
      },
      {
        kind: "PHONE",
        customerCode: "0812345678",
        serviceNumber: null,
        provider: "TRUE",
        name: "บัญชี",
        normalAmount: "299.00",
        dueDay: 15,
        status: "CLOSED",
      },
    ]);
  });

  it("แจ้งทุกบรรทัดที่ผิด รวมเบอร์ซ้ำที่เขียนต่างรูปแบบ", () => {
    const { rows, errors } = parsePhonesCsv(
      [HEADER, "097-3378822,,ก,374.50,9,,", "0973378822,,ข,374.50,9,,", "12,,,x,40,,ย้าย"].join("\n"),
    );
    expect(rows).toHaveLength(1);
    expect(errors).toEqual([
      "บรรทัด 3: เบอร์ 097-3378822 ซ้ำกับบรรทัด 2",
      'บรรทัด 4: หมายเลขโทรศัพท์ไม่ถูกต้อง "12", ไม่มีผู้ใช้บริการ, ยอดปกติไม่ถูกต้อง "x", วันครบกำหนดต้องเป็นเลข 1-31 แต่ได้ "40", สถานะไม่รู้จัก "ย้าย" (ใช้ได้: ใช้งาน / ยกเลิก)',
    ]);
  });

  it("ขาดคอลัมน์จำเป็น", () => {
    expect(parsePhonesCsv("เบอร์,ยอดปกติ\n0973378822,374.5").errors[0]).toContain('ไม่พบคอลัมน์ "ผู้ใช้บริการ"');
  });
});

describe("centerStatusLabel", () => {
  it("เบอร์โทรศัพท์เรียก CLOSED ว่า ยกเลิก", () => {
    expect(centerStatusLabel("CLOSED")).toBe("ปิด");
    expect(centerStatusLabel("CLOSED", "PHONE")).toBe("ยกเลิก");
  });
});
