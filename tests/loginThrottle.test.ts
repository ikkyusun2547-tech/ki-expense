import { describe, expect, it } from "vitest";
import { checkLockout, minutesUntil, type Attempt } from "@/lib/auth/loginThrottle";

const now = new Date("2026-10-21T10:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000);
const fail = (m: number): Attempt => ({ success: false, createdAt: minutesAgo(m) });
const ok = (m: number): Attempt => ({ success: true, createdAt: minutesAgo(m) });

describe("checkLockout", () => {
  it("ไม่มีประวัติ ไม่ล็อก", () => {
    expect(checkLockout([], now)).toEqual({ locked: false });
  });

  it("ผิด 4 ครั้ง ยังไม่ล็อก", () => {
    expect(checkLockout([fail(1), fail(2), fail(3), fail(4)], now)).toEqual({ locked: false });
  });

  it("ผิด 5 ครั้งติดใน 15 นาที ล็อก จนครั้งเก่าสุดครบ 15 นาที", () => {
    const result = checkLockout([fail(1), fail(2), fail(3), fail(4), fail(10)], now);
    expect(result).toEqual({ locked: true, unlockAt: minutesAgo(10 - 15) });
  });

  it("มีล็อกอินสำเร็จคั่น นับใหม่", () => {
    expect(checkLockout([fail(1), fail(2), ok(3), fail(4), fail(5), fail(6)], now)).toEqual({ locked: false });
  });

  it("ความพยายามเก่ากว่า 15 นาทีไม่นับ", () => {
    expect(checkLockout([fail(1), fail(2), fail(3), fail(4), fail(16)], now)).toEqual({ locked: false });
  });
});

describe("minutesUntil", () => {
  it("ปัดขึ้น และอย่างน้อย 1 นาที", () => {
    expect(minutesUntil(new Date(now.getTime() + 61000), now)).toBe(2);
    expect(minutesUntil(now, now)).toBe(1);
  });
});
