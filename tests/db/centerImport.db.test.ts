import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { initialFormState } from "@/lib/formState";
import { login } from "@/server/actions/auth";
import { importCenters } from "@/server/actions/centerImport";
import { db } from "@/server/db";
import { cleanup, createTestUser, form, PASSWORD, PREFIX, run } from "./helpers";

// admin นำเข้าทะเบียนศูนย์จาก CSV: ตรวจก่อน (ไม่บันทึก) → นำเข้า (upsert ตามรหัสลูกค้า)
const code = (n: number) => `${PREFIX}C${n}`;
const csv = (lines: string[]) => ["รหัสลูกค้า,หมายเลขบริการ,ชื่อศูนย์,ยอดปกติ,วันครบกำหนด,สถานะ", ...lines].join("\r\n");

const submit = (text: string, mode: "preview" | "import") => {
  const fd = form({ mode });
  fd.set("file", new File(["﻿" + text], "centers.csv", { type: "text/csv" }));
  return run(() => importCenters({}, fd));
};

async function loginAs(name: string, role: "ADMIN" | "CREATOR") {
  await createTestUser(name, role);
  await run(() => login(initialFormState, form({ username: `${PREFIX}${name}`, password: PASSWORD })));
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("นำเข้าทะเบียนศูนย์จาก CSV", () => {
  it("ตรวจไฟล์ → บอกเพิ่มใหม่/อัปเดต/ไม่เปลี่ยน โดยยังไม่บันทึก; นำเข้า → upsert ทั้งไฟล์", async () => {
    await loginAs("admin", "ADMIN");
    await db.center.create({ data: { customerCode: code(1), provider: "3BB", name: "ศูนย์เดิม", normalAmount: "749.00", dueDay: 10 } });
    await db.center.create({ data: { customerCode: code(2), provider: "3BB", name: "ศูนย์ไม่เปลี่ยน", normalAmount: "599.00", dueDay: 5 } });
    const text = csv([
      `${code(1)},,ศูนย์เดิม (ย้ายที่),800,10,ใช้งาน`,
      `${code(2)},,ศูนย์ไม่เปลี่ยน,599,5,`,
      `${code(3)},044000003,ศูนย์ใหม่,749.00,31,ปิด`,
    ]);

    const preview = await submit(text, "preview");
    expect(preview).toMatchObject({ result: { preview: { newCount: 1, updateCount: 1, sameCount: 1 } } });
    expect(await db.center.count({ where: { customerCode: code(3) } })).toBe(0);

    expect(await submit(text, "import")).toEqual({ result: { imported: 3 } });
    expect(await db.center.findUniqueOrThrow({ where: { customerCode: code(1) } })).toMatchObject({ name: "ศูนย์เดิม (ย้ายที่)", dueDay: 10 });
    expect(await db.center.findUniqueOrThrow({ where: { customerCode: code(3) } })).toMatchObject({ status: "CLOSED", serviceNumber: "044000003" });
  });

  it("ไฟล์มีปัญหาแม้บรรทัดเดียว → ไม่นำเข้าอะไรเลย และบอกทุกบรรทัด", async () => {
    await loginAs("admin", "ADMIN");
    const result = await submit(csv([`${code(4)},,ศูนย์ดี,749,10,`, `${code(5)},,,abc,40,หาย`]), "import");
    expect(result).toMatchObject({ result: { errors: [expect.stringContaining("บรรทัด 3")] } });
    expect(await db.center.count({ where: { customerCode: { in: [code(4), code(5)] } } })).toBe(0);
  });

  it("ไม่ใช่ admin เรียกไม่ได้", async () => {
    await loginAs("creator", "CREATOR");
    expect(await submit(csv([`${code(6)},,ศูนย์,749,10,`]), "import")).toEqual({ redirect: "/" });
  });
});
