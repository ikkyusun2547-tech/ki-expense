import { describe, expect, it } from "vitest";
import { checkInvoiceFile, detectFileType, MAX_UPLOAD_BYTES, safeDisplayName } from "@/lib/files";

const bytes = (...b: number[]) => new Uint8Array(b);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00);

describe("detectFileType", () => {
  it("รู้จัก PDF / PNG / JPG จากเนื้อไฟล์", () => {
    expect(detectFileType(PDF)).toBe("pdf");
    expect(detectFileType(PNG)).toBe("png");
    expect(detectFileType(JPG)).toBe("jpg");
  });

  it("ไฟล์อื่น (เช่น .exe ที่เปลี่ยนนามสกุลเป็น .pdf) ไม่ผ่าน", () => {
    expect(detectFileType(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull(); // MZ = exe
    expect(detectFileType(new TextEncoder().encode("<html>"))).toBeNull();
  });
});

describe("checkInvoiceFile", () => {
  it("ไฟล์ว่าง", () => {
    expect(checkInvoiceFile(new Uint8Array())).toEqual({ ok: false, error: "ไฟล์ว่างเปล่า" });
  });

  it("ใหญ่เกิน 10MB", () => {
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(PDF);
    expect(checkInvoiceFile(big)).toEqual({ ok: false, error: "ไฟล์ใหญ่เกิน 10MB" });
  });

  it("10MB พอดียังผ่าน", () => {
    const max = new Uint8Array(MAX_UPLOAD_BYTES);
    max.set(PDF);
    expect(checkInvoiceFile(max)).toEqual({ ok: true, type: "pdf" });
  });

  it("ชนิดไม่รองรับ", () => {
    expect(checkInvoiceFile(bytes(1, 2, 3))).toEqual({ ok: false, error: "รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG" });
  });
});

describe("safeDisplayName", () => {
  it("ตัดอักขระอันตราย คงภาษาไทย", () => {
    expect(safeDisplayName('..\\..\\ใบแจ้งหนี้ "ต.ค.".pdf')).toBe(".._.._ใบแจ้งหนี้ _ต.ค._.pdf");
    expect(safeDisplayName("a\r\nb.pdf")).toBe("a__b.pdf");
    expect(safeDisplayName("   ")).toBe("invoice");
  });
});
