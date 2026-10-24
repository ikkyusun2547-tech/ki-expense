import { describe, expect, it } from "vitest";
import { nameInitial } from "@/lib/thai/name";

describe("nameInitial", () => {
  it.each([
    ["นางสาวสมศรี ใจดี", "ส"],
    ["นางวิไล บัญชีกิจ", "ว"],
    ["นาย เมธี จันทร์งาม", "เ"],
    ["น.ส.ปิยะ", "ป"],
    ["ผู้ดูแลระบบ", "ผ"],
    ["นาง", "น"], // มีแค่คำนำหน้า ไม่ตัด
    ["  ", "?"],
  ])("%s → %s", (name, initial) => expect(nameInitial(name)).toBe(initial));
});
