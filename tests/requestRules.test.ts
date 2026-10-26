import { describe, expect, it } from "vitest";
import { checkRequest, needsConfirm, type CenterForRules, type RequestDraft } from "@/lib/rules/requestRules";

const center: CenterForRules = { status: "ACTIVE", normalAmount: "749.00" };

// ใบเบิกที่ถูกต้องครบ ไม่มีคำเตือน
const valid: RequestDraft = {
  invoiceNo: "INV-001",
  amount: "749",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  dueDate: "2026-10-15",
  hasFile: true,
};

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

describe("checkRequest", () => {
  it("ใบปกติ ผ่านโดยไม่มีคำเตือน", () => {
    expect(checkRequest(valid, center, [])).toEqual({ blocks: [], warnings: [] });
  });

  describe("บล็อก", () => {
    it.each(["MOVED", "CLOSED"] as const)("ศูนย์สถานะ %s", (status) => {
      const { blocks } = checkRequest(valid, { ...center, status }, []);
      expect(codes(blocks)).toEqual(["CENTER_INACTIVE"]);
    });

    it("ข้อมูลไม่ครบ บอกชื่อช่องที่ขาด", () => {
      const { blocks } = checkRequest({ ...valid, invoiceNo: " ", dueDate: "" }, center, []);
      expect(blocks).toEqual([
        { code: "MISSING_FIELD", message: "กรอกข้อมูลไม่ครบ: เลขที่ใบแจ้งหนี้, วันครบกำหนด" },
      ]);
    });

    it.each(["abc", "0", "0.00", "12.345", "-749"])("ยอดไม่ถูกต้อง %j", (amount) => {
      const { blocks } = checkRequest({ ...valid, amount }, center, []);
      expect(codes(blocks)).toContain("INVALID_AMOUNT");
    });

    it("วันที่ไม่มีจริง", () => {
      const { blocks } = checkRequest({ ...valid, periodEnd: "2026-09-31" }, center, []);
      expect(codes(blocks)).toEqual(["INVALID_DATE"]);
    });

    it("วันสิ้นสุดก่อนวันเริ่ม", () => {
      const { blocks } = checkRequest(
        { ...valid, periodStart: "2026-09-30", periodEnd: "2026-09-01" },
        center,
        [],
      );
      expect(codes(blocks)).toEqual(["PERIOD_REVERSED"]);
    });

    it("รอบบริการทับกับใบเดิม แม้แค่วันขอบ — ข้อความแสดง พ.ศ.", () => {
      const { blocks } = checkRequest(valid, center, [
        { periodStart: "2026-08-01", periodEnd: "2026-08-31" },
        { periodStart: "2026-09-30", periodEnd: "2026-10-29" },
      ]);
      expect(blocks).toEqual([
        {
          code: "PERIOD_OVERLAP",
          message: "ศูนย์นี้มีใบเบิกรอบ 30 ก.ย. 2569 – 29 ต.ค. 2569 อยู่แล้ว (รอบบริการทับกัน)",
        },
      ]);
    });

    it("รอบต่อกันพอดีไม่ถือว่าซ้ำ", () => {
      const { blocks } = checkRequest(valid, center, [
        { periodStart: "2026-08-01", periodEnd: "2026-08-31" },
        { periodStart: "2026-10-01", periodEnd: "2026-10-31" },
      ]);
      expect(blocks).toEqual([]);
    });
  });

  describe("เตือน (ไม่บล็อก)", () => {
    it("ยอดต่างจากยอดปกติ", () => {
      const { blocks, warnings } = checkRequest({ ...valid, amount: "1068.93" }, center, []);
      expect(blocks).toEqual([]);
      expect(warnings).toEqual([
        { code: "AMOUNT_DIFFERS", message: "ยอด 1,068.93 บาท ต่างจากยอดปกติ 749.00 บาท" },
      ]);
    });

    it("ยอดเท่ากันแต่เขียนต่างรูปแบบ ไม่เตือน", () => {
      const { warnings } = checkRequest({ ...valid, amount: "749.00" }, center, []);
      expect(warnings).toEqual([]);
    });

    it.each([
      ["2026-09-01", "2026-09-25", false], // 25 วัน — ขอบล่างยังปกติ
      ["2026-09-01", "2026-10-05", false], // 35 วัน — ขอบบนยังปกติ
      ["2026-09-01", "2026-09-24", true], // 24 วัน
      ["2026-09-01", "2026-10-06", true], // 36 วัน
    ])("รอบ %s – %s เตือน=%s", (periodStart, periodEnd, warn) => {
      const { warnings } = checkRequest({ ...valid, periodStart, periodEnd }, center, []);
      expect(codes(warnings).includes("PERIOD_LENGTH")).toBe(warn);
    });

    it("ไม่ได้แนบไฟล์", () => {
      const { blocks, warnings } = checkRequest({ ...valid, hasFile: false }, center, []);
      expect(blocks).toEqual([]);
      expect(codes(warnings)).toEqual(["NO_FILE"]);
    });
  });

  it("แจ้งทุกปัญหาพร้อมกัน", () => {
    const result = checkRequest(
      { ...valid, amount: "800", periodEnd: "2026-10-20", hasFile: false },
      { ...center, status: "CLOSED" },
      [{ periodStart: "2026-10-01", periodEnd: "2026-10-31" }],
    );
    expect(codes(result.blocks)).toEqual(["CENTER_INACTIVE", "PERIOD_OVERLAP"]);
    expect(codes(result.warnings)).toEqual(["PERIOD_LENGTH", "AMOUNT_DIFFERS", "NO_FILE"]);
  });
});

describe("needsConfirm", () => {
  it("ยอดต่างจากปกติอย่างเดียว ไม่ต้องกดยืนยันซ้ำ; คำเตือนอื่นยังต้องยืนยัน", () => {
    const amount = { code: "AMOUNT_DIFFERS" as const, message: "" };
    const noFile = { code: "NO_FILE" as const, message: "" };
    expect(needsConfirm([])).toBe(false);
    expect(needsConfirm([amount])).toBe(false);
    expect(needsConfirm([amount, noFile])).toBe(true);
  });
});
