import { describe, expect, it } from "vitest";
import { decodeCsvBuffer, parseCentersCsv } from "@/lib/centers/parseCentersCsv";

const HEADER = "รหัสลูกค้า,หมายเลขบริการ,ชื่อศูนย์,ยอดปกติ,วันครบกำหนด,สถานะ";

describe("parseCentersCsv", () => {
  it("อ่านแถวปกติ และแปลงสถานะภาษาไทยเป็น enum", () => {
    const csv = [
      HEADER,
      "1001,0441234567,ศูนย์ท่าตูม,749,5,ใช้งาน",
      "1002,,ศูนย์ศีขรภูมิ,\"1,068.93\",20,ย้าย",
      "1003,0449999999,ศูนย์รัตนบุรี,631.30,31,ปิด",
    ].join("\n");

    const { rows, errors } = parseCentersCsv(csv);

    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { customerCode: "1001", serviceNumber: "0441234567", provider: "3BB", name: "ศูนย์ท่าตูม", normalAmount: "749.00", dueDay: 5, status: "ACTIVE" },
      { customerCode: "1002", serviceNumber: null, provider: "3BB", name: "ศูนย์ศีขรภูมิ", normalAmount: "1068.93", dueDay: 20, status: "MOVED" },
      { customerCode: "1003", serviceNumber: "0449999999", provider: "3BB", name: "ศูนย์รัตนบุรี", normalAmount: "631.30", dueDay: 31, status: "CLOSED" },
    ]);
  });

  it("ตัด BOM และช่องว่างรอบค่า", () => {
    const { rows, errors } = parseCentersCsv(`﻿${HEADER}\n 1001 , , ศูนย์ท่าตูม , 749 , 5 , ใช้งาน `);
    expect(errors).toEqual([]);
    expect(rows[0].customerCode).toBe("1001");
    expect(rows[0].name).toBe("ศูนย์ท่าตูม");
  });

  it("คอลัมน์ระบบ (ค่าย): ไม่มีคอลัมน์/ว่าง = 3BB, ตัวพิมพ์ใหญ่", () => {
    const { rows, errors } = parseCentersCsv(["รหัสลูกค้า,ระบบ,ชื่อศูนย์,ยอดปกติ,วันครบกำหนด", "1001,true,ศูนย์ ก,749,5", "1002,,ศูนย์ ข,749,5"].join("\n"));
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.provider)).toEqual(["TRUE", "3BB"]);
  });

  it("สถานะว่าง ถือเป็น ใช้งาน", () => {
    const { rows } = parseCentersCsv(`${HEADER}\n1001,,ศูนย์ท่าตูม,749,5,`);
    expect(rows[0].status).toBe("ACTIVE");
  });

  it("แจ้งรหัสลูกค้าซ้ำพร้อมเลขบรรทัด", () => {
    const csv = [HEADER, "1001,,ศูนย์ ก,749,5,ใช้งาน", "1001,,ศูนย์ ข,749,5,ใช้งาน"].join("\n");
    const { rows, errors } = parseCentersCsv(csv);
    expect(rows).toHaveLength(1);
    expect(errors).toEqual(["บรรทัด 3: รหัสลูกค้า 1001 ซ้ำกับบรรทัด 2"]);
  });

  it("รวม error ทุกช่องของบรรทัดที่ผิด", () => {
    const { rows, errors } = parseCentersCsv(`${HEADER}\n,,,abc,32,ระงับ`);
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("บรรทัด 2");
    expect(errors[0]).toContain("ไม่มีรหัสลูกค้า");
    expect(errors[0]).toContain("ไม่มีชื่อศูนย์");
    expect(errors[0]).toContain("ยอดปกติไม่ถูกต้อง");
    expect(errors[0]).toContain("วันครบกำหนดต้องเป็นเลข 1-31");
    expect(errors[0]).toContain('สถานะไม่รู้จัก "ระงับ"');
  });

  it("แจ้งเมื่อขาดคอลัมน์จำเป็น", () => {
    const { errors } = parseCentersCsv("รหัสลูกค้า,ชื่อศูนย์\n1001,ศูนย์ท่าตูม");
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('ไม่พบคอลัมน์ "ยอดปกติ"');
    expect(errors[1]).toContain('ไม่พบคอลัมน์ "วันครบกำหนด"');
  });
});

describe("decodeCsvBuffer", () => {
  it("อ่าน UTF-8", () => {
    const { text, encoding } = decodeCsvBuffer(new TextEncoder().encode("สุรินทร์"));
    expect(encoding).toBe("utf-8");
    expect(text).toBe("สุรินทร์");
  });

  it("อ่าน windows-874 (CSV จาก Excel แบบ ANSI)", () => {
    const tis620 = new Uint8Array([0xca, 0xd8, 0xc3, 0xd4, 0xb9, 0xb7, 0xc3, 0xec]);
    const { text, encoding } = decodeCsvBuffer(tis620);
    expect(encoding).toBe("windows-874");
    expect(text).toBe("สุรินทร์");
  });
});
