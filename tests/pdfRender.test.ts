import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildMemo, DEFAULT_MEMO_SETTINGS } from "@/lib/pdf/memoData";

vi.mock("server-only", () => ({}));
const { renderInternalMemo } = await import("@/server/pdf");

// สร้าง PDF จริงด้วยฟอนต์ที่ฝังไว้ — ตั้ง PDF_SAMPLE=<path> เพื่อเก็บไฟล์ไว้เปิดดูด้วยตา
describe("renderInternalMemo", () => {
  it("ได้ไฟล์ PDF หน้าเดียว ฝังฟอนต์ Sarabun", async () => {
    const data = buildMemo({
      memoDate: "2026-10-16",
      customerCode: "600197730",
      serviceUser: "ห้องรับรองคุณมั่นคง",
      amount: "749",
      dueDate: "2026-11-12",
      requesterName: "นางสาวทดสอบ จัดทำ",
      settings: { ...DEFAULT_MEMO_SETTINGS, approverName: "นายทดสอบ อนุมัติ" },
    });
    const pdf = await renderInternalMemo(data);
    if (process.env.PDF_SAMPLE) writeFileSync(process.env.PDF_SAMPLE, pdf);

    const raw = pdf.toString("latin1");
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
    expect(raw).toMatch(/\/FontFile2/); // ฟอนต์ TrueType ถูกฝังในไฟล์
    expect(raw).toMatch(/Sarabun/);
  });
});
