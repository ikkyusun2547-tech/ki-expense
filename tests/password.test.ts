import { describe, expect, it } from "vitest";
import { generateTempPassword, hashPassword, verifyPassword } from "@/server/password";

describe("generateTempPassword", () => {
  it("ยาว 10 ตัว ไม่มีตัวที่สับสนง่าย และไม่ซ้ำกัน", () => {
    const passwords = Array.from({ length: 50 }, () => generateTempPassword());
    for (const p of passwords) expect(p).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{10}$/);
    expect(new Set(passwords).size).toBe(50);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("รหัสถูกผ่าน รหัสผิดไม่ผ่าน", async () => {
    const stored = await hashPassword("รหัสผ่าน-Test1");
    expect(stored.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("รหัสผ่าน-Test1", stored)).toBe(true);
    expect(await verifyPassword("รหัสผ่าน-test1", stored)).toBe(false);
  });

  it("hash รหัสเดียวกันสองครั้งได้ค่าต่างกัน (salt สุ่ม)", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("ค่าที่เก็บผิดรูปแบบ ถือว่าไม่ผ่าน", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$abc")).toBe(false);
  });
});
