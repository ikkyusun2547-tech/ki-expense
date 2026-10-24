import { describe, expect, it } from "vitest";
import {
  compareSummaries,
  daysUntil,
  dueDateInMonth,
  summarizeCenter,
  type SummaryRequest,
} from "@/lib/rules/centerSummary";

const req = (dueDate: string, status: SummaryRequest["status"] = "CREATED"): SummaryRequest => ({ id: dueDate, dueDate, status });

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

describe("summarizeCenter (วันนี้ 22 ต.ค. 2569)", () => {
  const today = "2026-10-22";

  it("ครบกำหนดไปแล้ว (15 ต.ค.) ยังไม่เบิก → เลยกำหนด", () => {
    expect(summarizeCenter(15, [], today)).toEqual({ state: "OVERDUE", dueDate: "2026-10-15", daysLeft: -7 });
  });

  it("ครบกำหนดวันนี้ ยังไม่เบิก → ใกล้ครบกำหนด (เหลือ 0 วัน)", () => {
    expect(summarizeCenter(22, [], today)).toMatchObject({ state: "DUE_SOON", daysLeft: 0 });
  });

  it("เหลือ 7 วันพอดี → ใกล้ครบกำหนด; เหลือ 8 วัน → ยังไม่ถึงรอบ", () => {
    expect(summarizeCenter(29, [], today)).toMatchObject({ state: "DUE_SOON", dueDate: "2026-10-29", daysLeft: 7 });
    expect(summarizeCenter(30, [], today)).toMatchObject({ state: "NOT_YET", daysLeft: 8 });
  });

  it("มีใบเบิกที่ครบกำหนดเดือนนี้ (สถานะใดก็ได้) → เบิกแล้ว", () => {
    const r = req("2026-10-18", "SENT");
    expect(summarizeCenter(15, [r], today)).toEqual({ state: "REQUESTED", dueDate: "2026-10-15", daysLeft: -7, request: r });
  });

  it("ใบเบิกของเดือนอื่นไม่นับเป็นเดือนนี้", () => {
    expect(summarizeCenter(15, [req("2026-09-15", "PAID")], today)).toMatchObject({ state: "OVERDUE" });
  });

  it("เดือนนี้เบิกแล้ว และเดือนหน้าใกล้ครบ (2 พ.ย.) แต่ยังไม่เบิก → เตือนเดือนหน้า", () => {
    const result = summarizeCenter(2, [req("2026-10-02", "PAID")], "2026-10-28");
    expect(result).toEqual({ state: "DUE_SOON", dueDate: "2026-11-02", daysLeft: 5 });
  });

  it("เดือนนี้และเดือนหน้าเบิกแล้วทั้งคู่ → เบิกแล้ว", () => {
    const result = summarizeCenter(2, [req("2026-10-02"), req("2026-11-02")], "2026-10-28");
    expect(result).toMatchObject({ state: "REQUESTED", dueDate: "2026-10-02" });
  });

  it("ข้ามปี: ธ.ค. เบิกแล้ว ม.ค. ใกล้ครบ", () => {
    expect(summarizeCenter(3, [req("2026-12-03")], "2026-12-29")).toMatchObject({ state: "DUE_SOON", dueDate: "2027-01-03", daysLeft: 5 });
  });
});

describe("compareSummaries", () => {
  it("เรียง เลยกำหนด → ใกล้ครบ (เหลือน้อยก่อน) → ยังไม่ถึงรอบ → เบิกแล้ว", () => {
    const today = "2026-10-22";
    const rows = [
      summarizeCenter(15, [req("2026-10-15")], today),
      summarizeCenter(30, [], today),
      summarizeCenter(28, [], today),
      summarizeCenter(23, [], today),
      summarizeCenter(1, [], today),
    ];
    expect(rows.sort(compareSummaries).map((r) => [r.state, r.dueDate])).toEqual([
      ["OVERDUE", "2026-10-01"],
      ["DUE_SOON", "2026-10-23"],
      ["DUE_SOON", "2026-10-28"],
      ["NOT_YET", "2026-10-30"],
      ["REQUESTED", "2026-10-15"],
    ]);
  });
});
