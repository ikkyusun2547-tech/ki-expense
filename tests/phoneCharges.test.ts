import { describe, expect, it } from "vitest";
import { packageFromNormal, phoneCharges } from "@/lib/rules/phoneCharges";

describe("phoneCharges", () => {
  it("ตามบิล True ตัวอย่าง: 350.00 + 31.68 → VAT 26.72 รวม 408.40", () => {
    expect(phoneCharges("350", "31.68")).toEqual({
      packageAmount: "350.00",
      extraAmount: "31.68",
      subtotal: "381.68",
      vat: "26.72",
      total: "408.40",
    });
  });

  it("ไม่มีส่วนเกิน (ช่องว่าง = 0) → 350.00 + VAT 24.50 = 374.50", () => {
    expect(phoneCharges("350.00", "")).toMatchObject({ extraAmount: "0.00", vat: "24.50", total: "374.50" });
  });

  it("VAT ปัดครึ่งขึ้นเป็นสตางค์", () => {
    expect(phoneCharges("0.07", "0")?.vat).toBe("0.00"); // 0.49 สตางค์ → 0
    expect(phoneCharges("0.08", "0")?.vat).toBe("0.01"); // 0.56 สตางค์ → 1
    expect(phoneCharges("1,234.50", "0")?.total).toBe("1320.92"); // 86.415 → 86.42
  });

  it.each([
    ["", "0"],
    ["abc", "0"],
    ["350", "-1"],
    ["350.123", "0"],
  ])("รูปแบบผิด → null (%s, %s)", (p, e) => {
    expect(phoneCharges(p, e)).toBeNull();
  });
});

describe("packageFromNormal", () => {
  it.each([
    ["374.50", "350.00"],
    ["321.00", "300.00"],
    ["267.50", "250.00"],
    ["100.00", "93.46"], // หารไม่ลงตัว → ปัดเป็นสตางค์
  ])("%s → %s", (normal, expected) => {
    expect(packageFromNormal(normal)).toBe(expected);
  });
});
