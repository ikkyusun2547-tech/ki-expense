// จำกัดการลองรหัสผิด: ผิดติดกัน MAX_FAILURES ครั้งภายใน LOCKOUT_MINUTES นาที → ล็อกชื่อผู้ใช้นั้นชั่วคราว
// ระหว่างล็อกไม่บันทึกความพยายามเพิ่ม เวลาล็อกจึงไม่ยืดออกไปเรื่อย ๆ

export const MAX_FAILURES = 5;
export const LOCKOUT_MINUTES = 15;

const WINDOW_MS = LOCKOUT_MINUTES * 60 * 1000;

export type Attempt = { success: boolean; createdAt: Date };

export type LockoutStatus = { locked: false } | { locked: true; unlockAt: Date };

// attempts: ความพยายามล่าสุด เรียงใหม่ → เก่า (ใช้แค่ MAX_FAILURES รายการแรก)
export function checkLockout(attempts: Attempt[], now: Date): LockoutStatus {
  const recentFailures: Attempt[] = [];
  for (const a of attempts) {
    if (now.getTime() - a.createdAt.getTime() > WINDOW_MS) break;
    if (a.success) break;
    recentFailures.push(a);
    if (recentFailures.length === MAX_FAILURES) break;
  }

  if (recentFailures.length < MAX_FAILURES) return { locked: false };

  // ปลดล็อกเมื่อความพยายามผิดครั้งเก่าสุดใน 5 ครั้งนี้หลุดออกจากช่วงเวลา
  const oldest = recentFailures[MAX_FAILURES - 1];
  return { locked: true, unlockAt: new Date(oldest.createdAt.getTime() + WINDOW_MS) };
}

export function minutesUntil(date: Date, now: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 60000));
}
