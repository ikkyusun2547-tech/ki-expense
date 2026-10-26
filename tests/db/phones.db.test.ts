import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { initialFormState } from "@/lib/formState";
import { login } from "@/server/actions/auth";
import { importCenters } from "@/server/actions/centerImport";
import { deleteCenter, saveCenter, savePhone } from "@/server/actions/centers";
import { findCenterByCode } from "@/server/actions/requests";
import { db } from "@/server/db";
import { getCenterSummaries } from "@/server/services/summary";
import { cleanup, createTestUser, form, PASSWORD, PREFIX, run, TEST_PHONE_PREFIX } from "./helpers";

// ทะเบียนเบอร์โทรศัพท์ (Center kind = PHONE): admin เพิ่ม/แก้/ลบ/นำเข้า และต้องไม่ปนกับงานค่าอินเทอร์เน็ต
const phone = (n: number) => `${TEST_PHONE_PREFIX}${String(n).padStart(3, "0")}`; // 0990000001
const dashed = (n: number) => `${phone(n).slice(0, 3)}-${phone(n).slice(3)}`;

const phoneForm = (n: number, extra: Record<string, string> = {}) =>
  form({
    phoneNumber: dashed(n),
    provider: "true",
    accountCode: "24391360",
    name: "รัฐกิจสัมพันธ์",
    normalAmount: "374.50",
    dueDay: "9",
    status: "ACTIVE",
    ...extra,
  });

async function loginAs(name: string, role: "ADMIN" | "CREATOR") {
  await createTestUser(name, role);
  await run(() => login(initialFormState, form({ username: `${PREFIX}${name}`, password: PASSWORD })));
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("admin จัดการทะเบียนเบอร์โทรศัพท์", () => {
  beforeEach(() => loginAs("admin", "ADMIN"));

  it("เพิ่มเบอร์ → เก็บเป็นตัวเลขล้วน kind = PHONE; เบอร์ซ้ำ (เขียนต่างรูปแบบ) ถูกปฏิเสธ", async () => {
    expect(await run(() => savePhone(initialFormState, phoneForm(1)))).toEqual({ redirect: "/admin/phones" });
    expect(await db.center.findUniqueOrThrow({ where: { customerCode: phone(1) } })).toMatchObject({
      kind: "PHONE",
      provider: "TRUE",
      serviceNumber: "24391360",
      name: "รัฐกิจสัมพันธ์",
      dueDay: 9,
    });

    const dup = await run(() => savePhone(initialFormState, phoneForm(1, { phoneNumber: phone(1), name: "ซ้ำ" })));
    expect(dup).toMatchObject({ result: { fieldErrors: { phoneNumber: ["หมายเลขนี้มีในทะเบียนแล้ว"] } } });
  });

  it("แก้ไขเบอร์ได้ แต่ฟอร์มศูนย์แก้เบอร์โทรศัพท์ไม่ได้ (และกลับกัน)", async () => {
    await run(() => savePhone(initialFormState, phoneForm(2)));
    const saved = await db.center.findUniqueOrThrow({ where: { customerCode: phone(2) } });

    expect(await run(() => savePhone(initialFormState, phoneForm(2, { id: saved.id, status: "CLOSED" })))).toEqual({
      redirect: "/admin/phones",
    });
    expect((await db.center.findUniqueOrThrow({ where: { id: saved.id } })).status).toBe("CLOSED");

    const viaCenterForm = form({
      id: saved.id,
      customerCode: phone(2),
      serviceNumber: "",
      provider: "3BB",
      name: "x",
      normalAmount: "1",
      dueDay: "1",
      status: "ACTIVE",
    });
    await expect(run(() => saveCenter(initialFormState, viaCenterForm))).rejects.toThrow();
    expect((await db.center.findUniqueOrThrow({ where: { id: saved.id } })).kind).toBe("PHONE");
  });

  it("ลบเบอร์ที่ไม่เคยมีใบเบิก → กลับหน้าทะเบียนเบอร์", async () => {
    await run(() => savePhone(initialFormState, phoneForm(3)));
    const saved = await db.center.findUniqueOrThrow({ where: { customerCode: phone(3) } });
    expect(await run(() => deleteCenter(initialFormState, form({ id: saved.id })))).toEqual({ redirect: "/admin/phones" });
    expect(await db.center.count({ where: { id: saved.id } })).toBe(0);
  });

  it("สถานะ ย้าย ใช้กับเบอร์โทรศัพท์ไม่ได้ ทั้งในฟอร์มและใน DB", async () => {
    expect(await run(() => savePhone(initialFormState, phoneForm(4, { status: "MOVED" })))).toMatchObject({
      result: { fieldErrors: { status: expect.any(Array) } },
    });
    await expect(
      db.center.create({ data: { kind: "PHONE", customerCode: phone(4), name: "x", normalAmount: "1", dueDay: 1, status: "MOVED" } }),
    ).rejects.toThrow();
  });

  it("นำเข้าจาก CSV: ตรวจก่อน → นำเข้า; รหัสที่อยู่ในทะเบียนศูนย์แล้วไม่เขียนทับข้ามประเภท", async () => {
    const submit = (text: string, mode: "preview" | "import") => {
      const fd = form({ mode, kind: "PHONE" });
      fd.set("file", new File([text], "phones.csv", { type: "text/csv" }));
      return run(() => importCenters({}, fd));
    };
    const header = "หมายเลขโทรศัพท์,ระบบ,ผู้ใช้บริการ,ยอดปกติ,วันครบกำหนด";
    const text = [header, `${dashed(5)},,รัฐกิจสัมพันธ์,374.50,9`, `${phone(6).slice(1)},AIS,บัญชี,299,15`].join("\r\n");

    expect(await submit(text, "preview")).toMatchObject({ result: { preview: { newCount: 2, updateCount: 0 } } });
    expect(await submit(text, "import")).toEqual({ result: { imported: 2 } });
    expect(await db.center.findUniqueOrThrow({ where: { customerCode: phone(6) } })).toMatchObject({ kind: "PHONE", provider: "AIS" });

    await db.center.create({ data: { customerCode: phone(7), name: "ศูนย์", normalAmount: "749", dueDay: 5 } });
    const conflict = await submit([header, `${phone(7)},,ฝ่าย,100,1`].join("\r\n"), "import");
    expect(conflict).toMatchObject({ result: { errors: [expect.stringContaining("ซ้ำกับรหัสลูกค้าในทะเบียนศูนย์")] } });
    expect((await db.center.findUniqueOrThrow({ where: { customerCode: phone(7) } })).kind).toBe("INTERNET");
  });
});

describe("ค้นเบอร์ในฟอร์มใบเบิก", () => {
  it("ผู้จัดทำพิมพ์เบอร์แบบมีขีด → เจอเป็นค่าโทรศัพท์; สรุปแยกแท็บ ศูนย์ / เบอร์", async () => {
    await db.center.create({
      data: { kind: "PHONE", customerCode: phone(8), provider: "TRUE", name: "ฝ่ายทดสอบ", normalAmount: "374.50", dueDay: 9 },
    });
    await loginAs("creator", "CREATOR");

    expect(await run(() => findCenterByCode(dashed(8)))).toMatchObject({
      result: { ok: true, center: { kind: "PHONE", customerCode: phone(8), provider: "TRUE", name: "ฝ่ายทดสอบ" } },
    });
    expect(await run(() => findCenterByCode("099-9999999"))).toMatchObject({ result: { ok: false } });
    const has = (rows: Awaited<ReturnType<typeof getCenterSummaries>>) => rows.some((s) => s.center.customerCode === phone(8));
    expect(has(await getCenterSummaries("2026-10-26", "INTERNET"))).toBe(false);
    // ครบกำหนดทุกวันที่ 9 ยังไม่เคยเบิก → เลยกำหนดของเดือนนี้ (นับในตัวเลขบนเมนูผู้จัดทำด้วย)
    expect((await getCenterSummaries("2026-10-26", "PHONE")).find((s) => s.center.customerCode === phone(8))).toMatchObject({
      state: "OVERDUE",
      center: { kind: "PHONE" },
    });
  });

  it("ไม่ใช่ admin เพิ่มเบอร์ไม่ได้", async () => {
    await loginAs("creator", "CREATOR");
    expect(await run(() => savePhone(initialFormState, phoneForm(9)))).toEqual({ redirect: "/" });
    expect(await db.center.count({ where: { customerCode: phone(9) } })).toBe(0);
  });
});
