import { daysInclusive, type ISODate } from "@/lib/thai/date";

// ตัวช่วยเรื่องวันครบกำหนด — กรอกวันครบกำหนดล่วงหน้าในฟอร์ม (requestDefaults) และป้ายนับวันของฝ่ายบัญชี/ผู้อนุมัติ (DueBadge)
// (เลิกสรุปสถานะ "เลยกำหนด/ใกล้ครบ ยังไม่เบิก" ของศูนย์แล้ว — ผู้ใช้ตัด 2026-10-31 เพราะใบแจ้งหนี้แต่ละที่มาไม่ตรงกัน)

// ป้ายนับวันเป็นสีเหลืองเมื่อเหลือไม่เกินกี่วัน
export const DUE_SOON_DAYS = 7;

// วันครบกำหนดประจำเดือน; ถ้าเดือนนั้นไม่มีวันที่ dueDay (เช่น 31 ก.พ.) ใช้วันสุดท้ายของเดือน
export function dueDateInMonth(year: number, month: number, dueDay: number): ISODate {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(dueDay, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// จำนวนวันจาก today ถึง date (date วันนี้ = 0, พรุ่งนี้ = 1, เมื่อวาน = -1)
export function daysUntil(today: ISODate, date: ISODate): number {
  return date >= today ? daysInclusive(today, date) - 1 : -(daysInclusive(date, today) - 1);
}
