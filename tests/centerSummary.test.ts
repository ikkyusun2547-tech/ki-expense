import { describe, expect, it } from "vitest";
import { daysUntil, dueDateInMonth } from "@/lib/rules/centerSummary";

describe("dueDateInMonth", () => {
  it("วันปกติ", () => expect(dueDateInMonth(2026, 10, 15)).toBe("2026-10-15"));
  it("เดือนที่ไม่มีวันนั้น ใช้วันสุดท้ายของเดือน", () => {
    expect(dueDateInMonth(2027, 2, 31)).toBe("2027-02-28");
    expect(dueDateInMonth(2028, 2, 30)).toBe("2028-02-29");
    expect(dueDateInMonth(2026, 11, 31)).toBe("2026-11-30");
  });
});

describe("daysUntil", () => {
  it("วันนี้ = 0, อนาคตเป็นบวก, อดีตเป็นลบ", () => {
    expect(daysUntil("2026-10-22", "2026-10-22")).toBe(0);
    expect(daysUntil("2026-10-22", "2026-10-29")).toBe(7);
    expect(daysUntil("2026-10-22", "2026-10-20")).toBe(-2);
  });
});
