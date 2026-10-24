import { describe, expect, it } from "vitest";
import { paymentsCsv, type PaymentRow } from "@/lib/reports/paymentsCsv";

const row = (extra: Partial<PaymentRow> = {}): PaymentRow => ({
  paidDate: "2026-10-20",
  centerName: "ศูนย์ท่าตูม",
  customerCode: "600197701",
  invoiceNo: "3BB-6909-10071",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  dueDate: "2026-10-05",
  amount: "1068.93",
  paymentRef: "PV-001",
  approverName: "นายประเสริฐ มั่นคง",
  ...extra,
});

describe("paymentsCsv", () => {
  const csv = paymentsCsv("2026-10", [row(), row({ amount: "749", paymentRef: "PV-002", approverName: null })]);
  const lines = csv.slice(1).trimEnd().split("\r\n");

  it("มี BOM ให้ Excel อ่านภาษาไทยถูก และขึ้นบรรทัดแบบ CRLF", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("หัวรายงานเป็นเดือน พ.ศ. แล้วตามด้วยหัวตาราง", () => {
    expect(lines[0]).toBe("สรุปการจ่ายค่าอินเทอร์เน็ต เดือนตุลาคม 2569");
    expect(lines[1].split(",")[0]).toBe("ลำดับ");
  });

  it("แถวข้อมูล: วันที่ พ.ศ., ยอดไม่มีจุลภาค, ผู้อนุมัติว่างได้", () => {
    expect(lines[2]).toBe("1,20/10/2569,ศูนย์ท่าตูม,600197701,3BB-6909-10071,01/09/2569 - 30/09/2569,05/10/2569,1068.93,PV-001,นายประเสริฐ มั่นคง");
    expect(lines[3].endsWith(",749.00,PV-002,")).toBe(true);
  });

  it("แถวรวมท้ายตาราง (คำนวณเป็นสตางค์ ไม่ใช้ทศนิยม)", () => {
    expect(lines[4]).toBe(",,,,,,รวม 2 รายการ,1817.93,,");
  });

  it("ค่าที่มี , หรือ \" ครอบด้วยเครื่องหมายคำพูด; ค่าที่ขึ้นต้นเหมือนสูตร Excel ใส่ ' นำหน้า", () => {
    const out = paymentsCsv("2026-10", [row({ centerName: 'ศูนย์ "ใหม่", สาขา 2', paymentRef: "=1+1" })]);
    expect(out).toContain('"ศูนย์ ""ใหม่"", สาขา 2"');
    expect(out).toContain(",'=1+1,");
  });

  it("ไม่มีรายการ → มีแค่หัวและแถวรวม 0", () => {
    expect(paymentsCsv("2026-11", []).trimEnd().split("\r\n").at(-1)).toBe(",,,,,,รวม 0 รายการ,0.00,,");
  });
});
