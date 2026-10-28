import writeExcelFile, { type SheetData } from "write-excel-file/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as paymentsReport } from "@/app/api/reports/payments/route";
import { importCenters } from "@/server/actions/centerImport";
import { db } from "@/server/db";
import { form, run } from "./helpers";
import { requestFixtures } from "./requestFixtures";

// admin นำเข้าตารางรายปีแบบกระดาษเดิม (.xlsx) → ทะเบียนศูนย์ + ใบเบิกย้อนหลัง "จ่ายแล้ว" (imported)
const { createUsers, loginAs, userId, center, status } = requestFixtures("zz-yimp-");
const P = `zz-yimp-${Date.now()}-`;
const code = (n: number) => `${P}T${n}`;

// ตารางแบบกระดาษ: หัว 2 แถว, เดือนละ 3 ช่อง
function table(rows: (string | null)[][]): SheetData {
  return [
    ["ค่าอินเตอร์เน็ต 3BB ปี 2569"],
    ["ลำดับ", "ชื่อ", "หมายเลขบริการ", "รหัสลูกค้า", "กันยายน", null, null, "ตุลาคม", null, null],
    [null, null, null, null, "ค่าบริการ", "กำหนดชำระ", "รอบค่าบริการ", "ค่าบริการ", "กำหนดชำระ", "รอบค่าบริการ"],
    ...rows,
  ];
}

async function submit(rows: (string | null)[][], mode: "preview" | "import") {
  const fd = form({ mode });
  fd.set("file", new File([new Uint8Array(await writeExcelFile(table(rows)).toBuffer())], "ตาราง.xlsx"));
  return run(() => importCenters({}, fd));
}

beforeAll(createUsers);
afterAll(() => db.$disconnect());

describe("นำเข้าตารางรายปี (.xlsx)", () => {
  it("ตรวจ → นำเข้า: ศูนย์ใหม่ + ใบย้อนหลังจ่ายแล้ว (วันที่จ่าย = กำหนดชำระ); นำเข้าซ้ำ → ข้ามใบเดิม", async () => {
    await loginAs("ADMIN");
    const rows = [
      ["1", "ศูนย์โคกตะเคียน", "A211192000339", code(1), "631.30", "24/09/2569", "24/08/69-23/09/69", "631.30", "24/10/2569", "24/09/69-23/10/69"],
      ["2", "ศูนย์โนนคูณ", "A201059000026", code(2), "749", "10/09/2569", "10/08/69-09/09/69", "ย้ายศูนย์", null, null],
    ];

    const preview = await submit(rows, "preview");
    expect(preview).toMatchObject({ result: { preview: { newCount: 2, bills: { newCount: 3, skipCount: 0 } } } });
    expect(await db.center.count({ where: { customerCode: { in: [code(1), code(2)] } } })).toBe(0);

    expect(await submit(rows, "import")).toEqual({ result: { imported: 2, importedBills: 3 } });
    const a = await db.center.findUniqueOrThrow({ where: { customerCode: code(1) }, include: { requests: { include: { logs: true }, orderBy: { dueDate: "asc" } } } });
    expect(a).toMatchObject({ provider: "3BB", normalAmount: expect.anything(), dueDay: 24, status: "ACTIVE", serviceNumber: "A211192000339" });
    expect(a.normalAmount.toFixed(2)).toBe("631.30");
    expect(a.requests).toHaveLength(2);
    expect(a.requests[0]).toMatchObject({
      status: "PAID",
      imported: true,
      invoiceNo: "(ย้อนหลัง)",
      paymentRef: "นำเข้าจากตารางเดิม",
      createdById: await userId("ADMIN"),
    });
    expect(a.requests[0].paidDate?.toISOString().slice(0, 10)).toBe("2026-09-24");
    expect(a.requests[0].logs).toMatchObject([{ action: "CREATE", toStatus: "PAID", note: expect.stringContaining("นำเข้าย้อนหลัง") }]);
    expect(await db.center.findUniqueOrThrow({ where: { customerCode: code(2) } })).toMatchObject({ status: "MOVED", dueDay: 10 });

    // นำเข้าไฟล์เดิมซ้ำ → ไม่มีอะไรใหม่
    expect(await submit(rows, "preview")).toMatchObject({ result: { preview: { newCount: 0, sameCount: 2, bills: { newCount: 0, skipCount: 3 } } } });
    expect(await submit(rows, "import")).toEqual({ result: { imported: 2, importedBills: 0 } });
  });

  it("ศูนย์ที่มีอยู่แล้ว: ค่าย/ยอดปกติ/วันครบกำหนดคงเดิม; บิลที่ทับใบในระบบข้ามไป", async () => {
    const existing = await center(); // ยอดปกติ 749, มีค่ายของตัวเอง
    await db.center.update({ where: { id: existing.id }, data: { provider: "AIS" } });
    await db.request.create({
      data: {
        centerId: existing.id,
        invoiceNo: "INV-ในระบบ",
        amount: "749.00",
        periodStart: new Date("2026-09-24"),
        periodEnd: new Date("2026-10-23"),
        dueDate: new Date("2026-10-24"),
        department: "ฝ่าย",
        recipient: "เรียน",
        purpose: "เพื่อ",
        createdById: await userId("CREATOR"),
      },
    });
    await loginAs("ADMIN");
    const rows = [["1", "ชื่อใหม่", null, existing.customerCode, "700", "24/09/2569", "24/08/69-23/09/69", "700", "24/10/2569", "24/09/69-23/10/69"]];

    expect(await submit(rows, "import")).toEqual({ result: { imported: 1, importedBills: 1 } });
    const after = await db.center.findUniqueOrThrow({ where: { id: existing.id } });
    expect(after).toMatchObject({ name: "ชื่อใหม่", provider: "AIS", dueDay: existing.dueDay });
    expect(after.normalAmount.toFixed(2)).toBe("749.00");
  });

  it("ศูนย์ใหม่ที่ไม่ได้กรอกเดือนไหนเลย → แจ้งให้กรอก ไม่นำเข้าอะไร; บทบาทอื่นเรียกไม่ได้", async () => {
    await loginAs("ADMIN");
    const result = await submit([["1", "ศูนย์ว่าง", null, code(9)]], "import");
    expect(result).toMatchObject({ result: { errors: [expect.stringContaining("ต้องกรอกอย่างน้อย 1 เดือน")] } });
    expect(await db.center.count({ where: { customerCode: code(9) } })).toBe(0);

    await loginAs("CREATOR");
    expect(await submit([["1", "ศูนย์", null, code(10), "749", "24/09/2569", "24/08/69-23/09/69"]], "import")).toEqual({ redirect: "/" });
  });

  it("นำเข้าผิด → admin ลบใบย้อนหลังได้ (ต้องมีเหตุผล) แล้วนำเข้าใหม่; บทบาทอื่นลบไม่ได้", async () => {
    await loginAs("ADMIN");
    const wrong = [["1", "ศูนย์พิมพ์ผิด", null, code(20), "613.30", "24/09/2569", "24/08/69-23/09/69"]];
    await submit(wrong, "import");
    const bad = await db.request.findFirstOrThrow({ where: { center: { customerCode: code(20) } } });

    await loginAs("CREATOR");
    expect(await status(bad.id, "DELETE", "ผิด")).toMatchObject({ result: { error: expect.stringContaining("เฉพาะผู้ดูแลระบบ") } });
    await loginAs("ADMIN");
    expect(await status(bad.id, "DELETE")).toMatchObject({ result: { error: "กรุณาระบุเหตุผลที่ลบใบย้อนหลัง" } });
    expect(await status(bad.id, "DELETE", "พิมพ์ยอดผิด")).toEqual({ redirect: "/requests" });
    const deleted = await db.request.findUniqueOrThrow({ where: { id: bad.id }, include: { logs: { orderBy: { createdAt: "asc" } } } });
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.logs.at(-1)).toMatchObject({ action: "DELETE", fromStatus: "PAID", note: "พิมพ์ยอดผิด" });

    // แก้ยอดในไฟล์แล้วนำเข้าใหม่ → สร้างใบใหม่รอบเดิมได้ (ใบที่ลบไม่นับในกฎกันซ้ำ)
    const fixed = [["1", "ศูนย์พิมพ์ผิด", null, code(20), "631.30", "24/09/2569", "24/08/69-23/09/69"]];
    expect(await submit(fixed, "import")).toEqual({ result: { imported: 1, importedBills: 1 } });
    const live = await db.request.findFirstOrThrow({ where: { center: { customerCode: code(20) }, deletedAt: null } });
    expect(live.amount.toFixed(2)).toBe("631.30");
  });

  it("ใบย้อนหลังไม่อยู่ในรายงานการจ่ายรายเดือนของฝ่ายบัญชี", async () => {
    await loginAs("ACCOUNTING");
    const res = await run(() => paymentsReport(new Request("http://localhost/api/reports/payments?month=2026-09")));
    expect(res).toMatchObject({ result: expect.any(Response) });
    const imported = await db.request.count({ where: { imported: true, paidDate: { gte: new Date("2026-09-01"), lt: new Date("2026-10-01") } } });
    expect(imported).toBeGreaterThan(0);
    const { readSheet } = await import("read-excel-file/node");
    const data = await readSheet(Buffer.from(await (res as { result: Response }).result.arrayBuffer()));
    expect(JSON.stringify(data)).not.toContain(code(1));
  });
});
