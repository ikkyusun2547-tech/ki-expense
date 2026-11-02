import { describe, expect, it } from "vitest";
import { firstName, greeting, nameInitial, nameWithoutPrefix } from "@/lib/thai/name";

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

describe("firstName / greeting", () => {
  it.each([
    ["นางสาวสมศรี ใจดี", "สมศรี"],
    ["นาย เมธี จันทร์งาม", "เมธี"],
    ["ผู้ดูแลระบบ", "ผู้ดูแลระบบ"],
  ])("%s → %s", (name, first) => expect(firstName(name)).toBe(first));

  it("ทักทายตามช่วงเวลา (เวลาไทย)", () => {
    expect(greeting("นางสาวสมศรี ใจดี", 8)).toBe("สวัสดีตอนเช้า คุณสมศรี 👋");
    expect(greeting("นางสาวสมศรี ใจดี", 13)).toBe("สวัสดีตอนบ่าย คุณสมศรี 👋");
    expect(greeting("นางสาวสมศรี ใจดี", 18)).toBe("สวัสดีตอนเย็น คุณสมศรี 👋");
    expect(greeting("นางสาวสมศรี ใจดี", 23)).toBe("สวัสดี คุณสมศรี 👋");
  });
});

describe("nameWithoutPrefix", () => {
  it.each([
    ["นางสาวสมศรี ใจดี", "สมศรี ใจดี"],
    ["นาย เมธี จันทร์งาม", "เมธี จันทร์งาม"],
    ["ผู้ดูแลระบบ", "ผู้ดูแลระบบ"],
  ])("%s → %s", (name, full) => expect(nameWithoutPrefix(name)).toBe(full));
});
