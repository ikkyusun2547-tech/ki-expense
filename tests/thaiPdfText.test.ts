import { describe, expect, it } from "vitest";
import { thaiPdfText } from "@/lib/pdf/thaiText";

const codepoints = (s: string) => Array.from(s).map((c) => c.codePointAt(0)!.toString(16));

describe("thaiPdfText", () => {
  it("แยกสระอำเป็น นิคหิต + สระอา", () => {
    expect(thaiPdfText("จำกัด")).toBe("จํากัด");
  });

  it("มีวรรณยุกต์: นิคหิตมาก่อนวรรณยุกต์ (น้ำ → น ํ ้ า)", () => {
    expect(codepoints(thaiPdfText("น้ำ"))).toEqual(["e19", "e4d", "e49", "e32"]);
  });

  it("ทุกคำที่มีสระอำในใบเบิก", () => {
    for (const word of ["น้ำตาล", "ประจำ", "ผู้จัดทำ", "สำนักงาน", "จำกัด"]) {
      const out = thaiPdfText(word);
      expect(out).not.toContain("ำ");
      expect(out.normalize("NFC")).toBe(out); // ไม่มีอักขระแปลกเพิ่มเข้ามา
    }
  });

  it("ข้อความที่ไม่มีสระอำ ไม่เปลี่ยน", () => {
    expect(thaiPdfText("ผู้จัดการ 1,068.93 บาท")).toBe("ผู้จัดการ 1,068.93 บาท");
  });
});
