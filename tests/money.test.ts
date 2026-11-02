import { describe, expect, it } from "vitest";
import { formatAmount, fromSatang, parseAmount, toAmountString, toSatang } from "@/lib/money";

describe("parseAmount", () => {
  it.each([
    ["749", "749.00"],
    ["631.3", "631.30"],
    ["1,068.93", "1068.93"],
    [" 0749.00 ", "749.00"],
  ])("%s → %s", (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it.each(["", "abc", "12.345", "-5", "749 บาท"])("ปฏิเสธ %j", (raw) => {
    expect(parseAmount(raw)).toBeNull();
  });
});

describe("toAmountString", () => {
  it("รับ number และ object ที่มี toFixed (เช่น Prisma Decimal)", () => {
    expect(toAmountString(631.3)).toBe("631.30");
    expect(toAmountString({ toFixed: () => "1068.93" })).toBe("1068.93");
  });

  it("ปฏิเสธค่าติดลบ", () => {
    expect(() => toAmountString(-1)).toThrow();
  });
});

describe("toSatang", () => {
  it("เทียบยอดโดยไม่มีปัญหา float", () => {
    expect(toSatang(0.1 + 0.2)).toBe(toSatang("0.30"));
    expect(toSatang("1068.93")).toBe(BigInt(106893));
  });
});

describe("formatAmount", () => {
  it.each([
    ["749", "749.00"],
    ["1068.93", "1,068.93"],
    ["1234567.5", "1,234,567.50"],
  ])("%s → %s", (raw, expected) => {
    expect(formatAmount(raw)).toBe(expected);
  });
});

describe("fromSatang", () => {
  it("รวมยอดด้วยสตางค์แล้วแปลงกลับ ไม่เพี้ยน", () => {
    expect(fromSatang(toSatang("631.30") + toSatang("1068.93"))).toBe("1700.23");
    expect(fromSatang(BigInt(5))).toBe("0.05");
    expect(fromSatang(BigInt(0))).toBe("0.00");
  });
});
