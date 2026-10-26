import { describe, expect, it } from "vitest";
import { sameDayNextMonth, suggestRequest } from "@/lib/rules/requestDefaults";

const center = { normalAmount: "749.00", dueDay: 12 };

describe("sameDayNextMonth", () => {
  it.each([
    ["2026-10-19", "2026-11-19"],
    ["2026-10-31", "2026-11-30"], // วันสุดท้ายของเดือน → วันสุดท้ายของเดือนถัดไป
    ["2026-11-30", "2026-12-31"],
    ["2026-01-30", "2026-02-28"], // ก.พ. ไม่มีวันที่ 30
    ["2026-12-15", "2027-01-15"], // ข้ามปี
  ])("%s → %s", (input, expected) => {
    expect(sameDayNextMonth(input)).toBe(expected);
  });
});

describe("suggestRequest", () => {
  it("มีใบก่อนหน้า: รอบต่อจากใบล่าสุด 1 เดือน, ครบกำหนดเดือนถัดไป, ยอด = ยอดปกติ", () => {
    // ใบล่าสุด: 1–31 ต.ค. ครบกำหนด 12 พ.ย.
    expect(suggestRequest(center, { periodEnd: "2026-10-31", dueDate: "2026-11-12" }, "2026-11-20")).toEqual({
      amount: "749.00",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      dueDate: "2026-12-12",
    });
  });

  it("รอบกลางเดือน (20 ก.ย. – 19 ต.ค.) → 20 ต.ค. – 19 พ.ย.", () => {
    expect(suggestRequest({ normalAmount: "749.00", dueDay: 25 }, { periodEnd: "2026-10-19", dueDate: "2026-10-25" }, "2026-11-01")).toMatchObject({
      periodStart: "2026-10-20",
      periodEnd: "2026-11-19",
      dueDate: "2026-11-25",
    });
  });

  it("ครบกำหนดวันที่ 31 ในเดือนที่มี 30 วัน → วันสุดท้ายของเดือน; ข้ามปีได้", () => {
    expect(suggestRequest({ normalAmount: "1", dueDay: 31 }, { periodEnd: "2026-10-31", dueDate: "2026-10-31" }, "2026-11-01").dueDate).toBe("2026-11-30");
    expect(suggestRequest(center, { periodEnd: "2026-11-30", dueDate: "2026-12-12" }, "2026-12-20").dueDate).toBe("2027-01-12");
  });

  it("ยังไม่เคยเบิก: เว้นรอบบริการ, ครบกำหนด = วันที่ของศูนย์ในเดือนนี้ (ถ้ายังไม่ผ่าน)", () => {
    expect(suggestRequest(center, null, "2026-10-05")).toEqual({ amount: "749.00", periodStart: "", periodEnd: "", dueDate: "2026-10-12" });
    expect(suggestRequest(center, null, "2026-10-12").dueDate).toBe("2026-10-12"); // วันนี้ครบกำหนดพอดี
  });

  it("ยังไม่เคยเบิก และวันครบกำหนดเดือนนี้ผ่านไปแล้ว → เดือนถัดไป (ข้ามปีได้)", () => {
    expect(suggestRequest(center, null, "2026-10-24")).toEqual({ amount: "749.00", periodStart: "", periodEnd: "", dueDate: "2026-11-12" });
    expect(suggestRequest(center, null, "2026-12-20").dueDate).toBe("2027-01-12");
    expect(suggestRequest({ normalAmount: "1", dueDay: 31 }, null, "2027-01-31").dueDate).toBe("2027-01-31");
  });
});
