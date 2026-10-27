import { describe, expect, it } from "vitest";
import { checkPayment } from "@/lib/rules/paymentRules";

const today = "2026-10-22";

describe("checkPayment", () => {
  it("ถูกต้อง → ตัดช่องว่าง", () => {
    expect(checkPayment({ paidDate: "2026-10-22", paymentRef: "  PV-6910-001 " }, today)).toEqual({
      ok: true,
      paidDate: "2026-10-22",
      paymentRef: "PV-6910-001",
    });
  });

  it("วันที่จ่ายบังคับ / เลขอ้างอิงไม่บังคับ (ว่าง = null)", () => {
    expect(checkPayment({ paidDate: today, paymentRef: " " }, today)).toEqual({ ok: true, paidDate: today, paymentRef: null }); // เลขอ้างอิงไม่บังคับ
    expect(checkPayment({ paidDate: "", paymentRef: " " }, today)).toEqual({
      ok: false,
      errors: { paidDate: "กรอกวันที่จ่าย" },
    });
  });

  it("วันที่ในอนาคต / วันที่ไม่มีจริง", () => {
    expect(checkPayment({ paidDate: "2026-10-23", paymentRef: "x" }, today)).toEqual({
      ok: false,
      errors: { paidDate: "วันที่จ่ายต้องไม่เกินวันนี้" },
    });
    expect(checkPayment({ paidDate: "2026-02-30", paymentRef: "x" }, today)).toEqual({
      ok: false,
      errors: { paidDate: "วันที่จ่ายไม่ถูกต้อง" },
    });
  });

  it("เลขอ้างอิงยาวเกิน 100 ตัว", () => {
    expect(checkPayment({ paidDate: today, paymentRef: "x".repeat(101) }, today)).toMatchObject({
      ok: false,
      errors: { paymentRef: "เลขอ้างอิงยาวเกิน 100 ตัวอักษร" },
    });
  });
});
