import { describe, expect, it } from "vitest";
import {
  addDays,
  daysInclusive,
  beYear,
  formatBEDate,
  formatThaiDate,
  formatThaiDateTime,
  fromISODate,
  thaiMonthName,
  isISODate,
  periodsOverlap,
  toISODate,
  todayISO,
} from "@/lib/thai/date";

describe("isISODate", () => {
  it.each(["2026-10-21", "2028-02-29"])("ยอมรับ %s", (s) => expect(isISODate(s)).toBe(true));
  it.each(["2026-02-30", "2027-02-29", "21/10/2026", "2026-1-5", ""])("ปฏิเสธ %j", (s) =>
    expect(isISODate(s)).toBe(false),
  );
});

describe("แปลงไป-กลับกับ @db.Date", () => {
  it("fromISODate เป็นเที่ยงคืน UTC และ toISODate คืนค่าเดิม", () => {
    const d = fromISODate("2026-10-21");
    expect(d.toISOString()).toBe("2026-10-21T00:00:00.000Z");
    expect(toISODate(d)).toBe("2026-10-21");
  });
});

describe("todayISO", () => {
  it("ใช้เวลาไทย: 18:30 UTC = ตี 1 ครึ่งของวันถัดไป", () => {
    expect(todayISO(new Date("2026-10-21T18:30:00Z"))).toBe("2026-10-22");
    expect(todayISO(new Date("2026-10-21T16:59:00Z"))).toBe("2026-10-21");
  });
});

describe("addDays / daysInclusive", () => {
  it("ข้ามเดือนและปีอธิกสุรทิน", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("นับรวมวันแรกและวันสุดท้าย", () => {
    expect(daysInclusive("2026-09-01", "2026-09-30")).toBe(30);
    expect(daysInclusive("2026-08-15", "2026-09-14")).toBe(31);
    expect(daysInclusive("2026-10-21", "2026-10-21")).toBe(1);
  });
});

describe("periodsOverlap", () => {
  it("ทับกันแม้แค่วันขอบ", () => {
    expect(periodsOverlap("2026-09-01", "2026-09-30", "2026-09-30", "2026-10-29")).toBe(true);
  });
  it("ต่อกันพอดีไม่นับว่าทับ", () => {
    expect(periodsOverlap("2026-09-01", "2026-09-30", "2026-10-01", "2026-10-31")).toBe(false);
  });
  it("ช่วงหนึ่งอยู่ในอีกช่วง", () => {
    expect(periodsOverlap("2026-09-01", "2026-09-30", "2026-09-10", "2026-09-12")).toBe(true);
  });
});

describe("รูปแบบการแสดงผล", () => {
  it("หน้าจอเป็น พ.ศ.", () => {
    expect(formatThaiDate("2026-10-21")).toBe("21 ต.ค. 2569");
    expect(formatThaiDate("2026-01-05", "long")).toBe("5 มกราคม 2569");
  });
  it("วันเวลาเหตุการณ์เป็นเวลาไทย พ.ศ.", () => {
    expect(formatThaiDateTime(new Date("2026-10-21T07:05:00Z"))).toBe("21 ต.ค. 2569 14:05");
    expect(formatThaiDateTime(new Date("2026-12-31T17:30:00Z"))).toBe("1 ม.ค. 2570 00:30");
  });
  it("ใบเบิก (บันทึกภายใน) เป็น พ.ศ.", () => {
    expect(formatBEDate("2026-11-12")).toBe("12/11/2569");
    expect(formatBEDate("2027-01-05")).toBe("05/01/2570");
    expect(thaiMonthName("2026-11-12")).toBe("พฤศจิกายน");
    expect(beYear("2026-11-12")).toBe(2569);
  });
});
