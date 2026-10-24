import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/password";

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
