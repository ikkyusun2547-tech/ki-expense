import { existsSync, readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Role } from "@/generated/prisma/enums";
import { GET as getInvoice } from "@/app/api/requests/[id]/invoice/route";
import { initialFormState } from "@/lib/formState";
import { changeRequestStatus, findCenterByCode, saveRequest } from "@/server/actions/requests";
import { login } from "@/server/actions/auth";
import { db } from "@/server/db";
import { invoiceFilePath } from "@/server/files";
import { hashPassword } from "@/server/password";
import { form, PASSWORD, run } from "./helpers";
import { cookieJar } from "./setup";

// ใช้ prefix ต่างจาก auth test (zz-test-) เพราะข้อมูลชุดนี้มี ApprovalLog ซึ่งลบไม่ได้
// DB ทดสอบถูกล้างใหม่ทุกครั้งที่รัน จึงไม่ต้อง cleanup
const P = `zz-req-${Date.now()}-`;
let seq = 0;

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
const pdfFile = (name = "ใบแจ้งหนี้.pdf") => new File([PDF], name, { type: "application/pdf" });

async function user(role: Role) {
  return db.user.create({
    data: { username: `${P}${role.toLowerCase()}`, name: `ทดสอบ ${role}`, role, passwordHash: await hashPassword(PASSWORD), mustChangePassword: false },
  });
}

async function loginAs(role: Role) {
  cookieJar.clear();
  await run(() => login(initialFormState, form({ username: `${P}${role.toLowerCase()}`, password: PASSWORD })));
}

async function center(status: "ACTIVE" | "MOVED" | "CLOSED" = "ACTIVE") {
  return db.center.create({
    data: { customerCode: `${P}C${++seq}`, name: `ศูนย์ทดสอบ ${seq}`, normalAmount: "749.00", dueDay: 15, status },
  });
}

// ใบเบิกปกติ (ไม่มีคำเตือน) ของรอบ ก.ย. 2569
const valid = (centerId: string, extra: Record<string, string> = {}) => ({
  centerId,
  invoiceNo: "INV-001",
  amount: "749",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  dueDate: "2026-10-15",
  ...extra,
});

function requestForm(values: Record<string, string>, file: File | null = pdfFile()) {
  const fd = form(values);
  if (file) fd.set("invoiceFile", file);
  return fd;
}

const save = (values: Record<string, string>, file?: File | null) =>
  run(() => saveRequest({}, requestForm(values, file === undefined ? pdfFile() : file)));

const idFrom = (outcome: Awaited<ReturnType<typeof save>>) => {
  if (!("redirect" in outcome)) throw new Error(`expected redirect, got ${JSON.stringify(outcome)}`);
  return outcome.redirect.split("/").pop()!;
};

const countUploads = () => readdirSync(process.env.UPLOAD_DIR!, { recursive: true }).filter((f) => String(f).includes(".")).length;

const status = (id: string, action: string, note = "") =>
  run(() => changeRequestStatus(initialFormState, form({ id, action, note })));

beforeAll(async () => {
  await user("CREATOR");
  await user("ACCOUNTING");
  await user("ADMIN");
});
afterAll(() => db.$disconnect());

describe("ค้นหาศูนย์จากรหัสลูกค้า", () => {
  it("ผู้จัดทำค้นเจอ ได้ชื่อศูนย์และยอดปกติ", async () => {
    const c = await center();
    await loginAs("CREATOR");
    expect(await findCenterByCode(` ${c.customerCode} `)).toMatchObject({
      ok: true,
      center: { id: c.id, name: c.name, normalAmount: "749.00", status: "ACTIVE" },
    });
    expect(await findCenterByCode("ไม่มีรหัสนี้")).toEqual({ ok: false, error: "ไม่พบรหัสลูกค้า ไม่มีรหัสนี้ ในทะเบียนศูนย์" });
  });

  it("ฝ่ายบัญชีเรียกไม่ได้", async () => {
    await loginAs("ACCOUNTING");
    expect(await run(() => findCenterByCode("x"))).toEqual({ redirect: "/" });
  });
});

describe("สร้างใบเบิก", () => {
  it("ใบปกติ → บันทึก สถานะสร้างแล้ว มี log และไฟล์อยู่บนดิสก์", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));

    const r = await db.request.findUniqueOrThrow({ where: { id }, include: { logs: true } });
    expect(r).toMatchObject({ status: "CREATED", invoiceNo: "INV-001", invoiceFileName: "ใบแจ้งหนี้.pdf" });
    expect(r.amount.toFixed(2)).toBe("749.00");
    expect(r.logs).toMatchObject([{ action: "CREATE", toStatus: "CREATED" }]);
    expect(readFileSync(invoiceFilePath(r.invoiceFileKey!))).toEqual(Buffer.from(PDF));
  });

  it("มีคำเตือน → ยังไม่บันทึกจนกว่าจะยืนยัน", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const values = valid(c.id, { amount: "800", periodEnd: "2026-10-10" });

    const first = await save(values, null);
    expect(first).toEqual({
      result: {
        blocks: [],
        warnings: [
          { code: "PERIOD_LENGTH", message: "รอบบริการ 40 วัน (ปกติ 25–35 วัน)" },
          { code: "AMOUNT_DIFFERS", message: "ยอด 800.00 บาท ต่างจากยอดปกติ 749.00 บาท" },
          { code: "NO_FILE", message: "ยังไม่ได้แนบไฟล์ใบแจ้งหนี้" },
        ],
      },
    });
    expect(await db.request.count({ where: { centerId: c.id } })).toBe(0);

    const id = idFrom(await save({ ...values, confirmWarnings: "1" }, null));
    expect((await db.request.findUniqueOrThrow({ where: { id } })).invoiceFileKey).toBeNull();
  });

  it("รอบบริการทับกับใบเดิม → บล็อก แม้กดยืนยัน", async () => {
    const c = await center();
    await loginAs("CREATOR");
    idFrom(await save(valid(c.id)));

    const dup = await save({ ...valid(c.id, { periodStart: "2026-09-30", periodEnd: "2026-10-29" }), confirmWarnings: "1" });
    expect(dup).toMatchObject({ result: { blocks: [{ code: "PERIOD_OVERLAP" }] } });
    expect(await db.request.count({ where: { centerId: c.id } })).toBe(1);
  });

  it("มีคนบันทึกแทรกระหว่างตรวจกับบันทึก → constraint ใน DB กันไว้ ได้ข้อความไทย ไม่ค้างไฟล์", async () => {
    const c = await center();
    await loginAs("CREATOR");
    idFrom(await save(valid(c.id)));

    // จำลองจังหวะ: ตอนแอปตรวจกฎ ยังไม่เห็นใบเดิม (อีกคนเพิ่ง commit) → ไปชน Request_no_overlap ตอน insert
    const spy = vi.spyOn(db.request, "findMany").mockResolvedValueOnce([]);
    const filesBefore = countUploads();
    const result = await save(valid(c.id, { invoiceNo: "INV-002" }));
    spy.mockRestore();

    expect(result).toMatchObject({ result: { blocks: [{ code: "PERIOD_OVERLAP" }] } });
    expect(await db.request.count({ where: { centerId: c.id } })).toBe(1);
    expect(countUploads()).toBe(filesBefore);
  });

  it.each(["MOVED", "CLOSED"] as const)("ศูนย์สถานะ %s → บล็อก", async (s) => {
    const c = await center(s);
    await loginAs("CREATOR");
    expect(await save(valid(c.id))).toMatchObject({ result: { blocks: [{ code: "CENTER_INACTIVE" }] } });
  });

  it("ไฟล์ไม่ใช่ PDF/รูป (เช่น exe เปลี่ยนนามสกุล) → ไม่บันทึก", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const fake = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], "invoice.pdf", { type: "application/pdf" });
    expect(await save(valid(c.id), fake)).toEqual({ result: { blocks: [], warnings: [], error: "รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG" } });
    expect(await db.request.count({ where: { centerId: c.id } })).toBe(0);
  });

  it.each(["ACCOUNTING", "ADMIN"] as const)("%s สร้างใบเบิกไม่ได้", async (role) => {
    const c = await center();
    await loginAs(role);
    expect(await save(valid(c.id))).toEqual({ redirect: "/" });
    expect(await db.request.count({ where: { centerId: c.id } })).toBe(0);
  });
});

describe("แก้ไข / ส่งบัญชี / ลบ / ย้อนสถานะ", () => {
  it("แก้ไขใบ 'สร้างแล้ว' ได้ เปลี่ยนไฟล์แล้วไฟล์เดิมยังเก็บไว้", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));
    const before = await db.request.findUniqueOrThrow({ where: { id } });

    idFrom(await save({ ...valid(c.id, { invoiceNo: "INV-แก้" }), id }, pdfFile("ใหม่.pdf")));

    const after = await db.request.findUniqueOrThrow({ where: { id }, include: { logs: { orderBy: { createdAt: "asc" } } } });
    expect(after).toMatchObject({ invoiceNo: "INV-แก้", invoiceFileName: "ใหม่.pdf" });
    expect(after.invoiceFileKey).not.toBe(before.invoiceFileKey);
    expect(existsSync(invoiceFilePath(before.invoiceFileKey!))).toBe(true);
    expect(after.logs.map((l) => l.action)).toEqual(["CREATE", "EDIT"]);
  });

  it("แก้ไขโดยไม่เลือกไฟล์ใหม่ → ใช้ไฟล์เดิม ไม่เตือนว่าไม่มีไฟล์", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));
    const key = (await db.request.findUniqueOrThrow({ where: { id } })).invoiceFileKey;
    idFrom(await save({ ...valid(c.id, { invoiceNo: "INV-X" }), id }, null));
    expect((await db.request.findUniqueOrThrow({ where: { id } })).invoiceFileKey).toBe(key);
  });

  it("ส่งบัญชีแล้ว → แก้/ลบไม่ได้; ผู้จัดทำย้อนไม่ได้; admin ย้อนได้เมื่อระบุเหตุผล", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));

    expect(await status(id, "SEND")).toEqual({ redirect: `/requests/${id}` });
    expect((await db.request.findUniqueOrThrow({ where: { id } })).status).toBe("SENT");

    expect(await save({ ...valid(c.id, { invoiceNo: "X" }), id })).toMatchObject({
      result: { error: 'ใบเบิกสถานะ "ส่งบัญชีแล้ว" แก้ไขไม่ได้' },
    });
    expect(await status(id, "DELETE")).toEqual({ result: { error: 'ใบเบิกสถานะ "ส่งบัญชีแล้ว" ลบไม่ได้' } });
    expect(await status(id, "REVERT", "พิมพ์ผิด")).toEqual({ result: { error: "ผู้จัดทำไม่มีสิทธิ์ย้อนสถานะ" } });

    await loginAs("ADMIN");
    expect(await status(id, "REVERT", "  ")).toEqual({ result: { error: "กรุณาระบุเหตุผลที่ย้อนสถานะ" } });
    expect(await status(id, "REVERT", "ยอดผิด ให้ผู้จัดทำแก้")).toEqual({ redirect: `/requests/${id}` });

    const r = await db.request.findUniqueOrThrow({ where: { id }, include: { logs: { orderBy: { createdAt: "asc" } } } });
    expect(r.status).toBe("CREATED");
    expect(r.logs.map((l) => [l.action, l.fromStatus, l.toStatus, l.note])).toEqual([
      ["CREATE", null, "CREATED", null],
      ["SEND", "CREATED", "SENT", null],
      ["REVERT", "SENT", "CREATED", "ยอดผิด ให้ผู้จัดทำแก้"],
    ]);
  });

  it("ลบ (soft delete) แล้วสร้างรอบเดิมใหม่ได้", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));
    expect(await status(id, "DELETE")).toEqual({ redirect: "/requests" });

    const deleted = await db.request.findUniqueOrThrow({ where: { id }, include: { logs: true } });
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.logs.map((l) => l.action).sort()).toEqual(["CREATE", "DELETE"]);

    idFrom(await save(valid(c.id)));
    expect(await status(id, "SEND")).toEqual({ result: { error: "ไม่พบใบเบิกนี้" } });
  });

  it("ฝ่ายบัญชีเรียกปุ่มเปลี่ยนสถานะไม่ได้", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));
    await loginAs("ACCOUNTING");
    expect(await status(id, "SEND")).toEqual({ redirect: "/" });
    expect((await db.request.findUniqueOrThrow({ where: { id } })).status).toBe("CREATED");
  });

  it("ApprovalLog แก้/ลบไม่ได้ในระดับ DB", async () => {
    const log = await db.approvalLog.findFirstOrThrow();
    await expect(db.approvalLog.update({ where: { id: log.id }, data: { note: "แก้" } })).rejects.toThrow();
    await expect(db.approvalLog.delete({ where: { id: log.id } })).rejects.toThrow();
  });
});

describe("ดาวน์โหลดไฟล์ใบแจ้งหนี้", () => {
  it("ล็อกอินแล้วได้ไฟล์ พร้อม Content-Type ที่ถูกต้อง", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));

    await loginAs("ACCOUNTING");
    const res = await getInvoice(new Request("http://x"), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(encodeURIComponent("ใบแจ้งหนี้.pdf"));
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF);
  });

  it("ไม่ได้ล็อกอิน → ไปหน้าล็อกอิน", async () => {
    cookieJar.clear();
    expect(await run(() => getInvoice(new Request("http://x"), { params: Promise.resolve({ id: "any" }) }))).toEqual({
      redirect: "/login",
    });
  });
});
