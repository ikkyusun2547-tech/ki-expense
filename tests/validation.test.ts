import { describe, expect, it } from "vitest";
import {
  centerSchema,
  changePasswordSchema,
  fieldErrorsOf,
  userCreateSchema,
  userUpdateSchema,
} from "@/lib/validation";

describe("centerSchema", () => {
  const valid = {
    customerCode: " 1001 ",
    serviceNumber: "",
    name: "ศูนย์ท่าตูม",
    normalAmount: "1,068.9",
    dueDay: "5",
    status: "ACTIVE",
  };

  it("ตัดช่องว่าง แปลงยอดและวัน", () => {
    expect(centerSchema.parse(valid)).toEqual({
      customerCode: "1001",
      serviceNumber: null,
      name: "ศูนย์ท่าตูม",
      normalAmount: "1068.90",
      dueDay: 5,
      status: "ACTIVE",
    });
  });

  it("แจ้ง error ภาษาไทยรายช่อง", () => {
    const result = centerSchema.safeParse({ ...valid, customerCode: "", normalAmount: "abc", dueDay: "40", status: "X" });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = fieldErrorsOf(result.error);
    expect(errors.customerCode).toEqual(["กรอกรหัสลูกค้า"]);
    expect(errors.normalAmount).toEqual(["ยอดต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง"]);
    expect(errors.dueDay).toEqual(["วันครบกำหนดต้องอยู่ระหว่าง 1-31"]);
    expect(errors.status).toEqual(["เลือกสถานะ"]);
  });
});

describe("userCreateSchema", () => {
  it("ชื่อผู้ใช้เป็นตัวพิมพ์เล็ก อีเมลว่างเป็น null", () => {
    expect(userCreateSchema.parse({ username: " Somchai.K ", name: "สมชาย", email: "", role: "CREATOR" })).toEqual({
      username: "somchai.k",
      name: "สมชาย",
      email: null,
      role: "CREATOR",
    });
  });

  it.each(["ab", "สมชาย", "has space", "a".repeat(33)])("ปฏิเสธชื่อผู้ใช้ %j", (username) => {
    expect(userCreateSchema.safeParse({ username, name: "x", email: "", role: "CREATOR" }).success).toBe(false);
  });

  it("ปฏิเสธอีเมลผิดรูปแบบ", () => {
    expect(userCreateSchema.safeParse({ username: "abc", name: "x", email: "not-email", role: "CREATOR" }).success).toBe(false);
  });
});

describe("userUpdateSchema", () => {
  it("แปลง active เป็น boolean", () => {
    expect(userUpdateSchema.parse({ name: "x", email: "", role: "ADMIN", active: "false" }).active).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("ผ่านเมื่อถูกต้อง", () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: "old-pass", newPassword: "new-pass-1", confirmPassword: "new-pass-1" }).success,
    ).toBe(true);
  });

  it.each([
    [{ currentPassword: "old-pass", newPassword: "short", confirmPassword: "short" }, "newPassword"],
    [{ currentPassword: "old-pass", newPassword: "new-pass-1", confirmPassword: "new-pass-2" }, "confirmPassword"],
    [{ currentPassword: "same-pass", newPassword: "same-pass", confirmPassword: "same-pass" }, "newPassword"],
  ])("ปฏิเสธ %j ที่ช่อง %s", (input, field) => {
    const result = changePasswordSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrorsOf(result.error)[field]).toBeDefined();
  });
});
