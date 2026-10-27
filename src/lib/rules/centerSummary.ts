import type { RequestStatus } from "@/generated/prisma/enums";
import { daysInclusive, type ISODate } from "@/lib/thai/date";

// สรุปสถานะการเบิกของศูนย์ (ตารางสรุปรายศูนย์)
// - "เบิกแล้ว" ของเดือนใด = มีใบเบิก (ยังไม่ถูกลบ) ที่วันครบกำหนดชำระอยู่ในเดือนนั้น
//   หรือมีใบเบิกของรอบที่ใหม่กว่าแล้ว (ผู้ใช้เลือก 2026-10-27 — บิลก่อนหน้าถือว่าเรียบร้อย เช่น จ่ายด้วยกระดาษก่อนเริ่มใช้ระบบ)
// - "ใกล้ครบกำหนด" = เหลือไม่เกิน DUE_SOON_DAYS วันถึงวันครบกำหนดประจำเดือน แต่ยังไม่เบิก

export const DUE_SOON_DAYS = 7;

export type CenterSummaryState = "OVERDUE" | "DUE_SOON" | "REQUESTED" | "NOT_YET";

export type SummaryRequest = { id: string; dueDate: ISODate; status: RequestStatus };

export type CenterSummaryResult = {
  state: CenterSummaryState;
  dueDate: ISODate; // วันครบกำหนดของเดือนที่กำลังพิจารณา
  daysLeft: number; // ติดลบ = เลยกำหนดมาแล้ว
  request?: SummaryRequest; // ใบเบิกของเดือนนั้น (ถ้ามี)
};

// วันครบกำหนดประจำเดือน; ถ้าเดือนนั้นไม่มีวันที่ dueDay (เช่น 31 ก.พ.) ใช้วันสุดท้ายของเดือน
export function dueDateInMonth(year: number, month: number, dueDay: number): ISODate {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(dueDay, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const monthKey = (iso: ISODate) => iso.slice(0, 7);

// จำนวนวันจาก today ถึง date (date วันนี้ = 0, พรุ่งนี้ = 1, เมื่อวาน = -1)
export function daysUntil(today: ISODate, date: ISODate): number {
  return date >= today ? daysInclusive(today, date) - 1 : -(daysInclusive(date, today) - 1);
}

export function summarizeCenter(dueDay: number, requests: SummaryRequest[], today: ISODate): CenterSummaryResult {
  const [y, m] = today.split("-").map(Number);
  const thisDue = dueDateInMonth(y, m, dueDay);
  const nextDue = m === 12 ? dueDateInMonth(y + 1, 1, dueDay) : dueDateInMonth(y, m + 1, dueDay);

  // ใบของเดือนนั้นพอดีก่อน ไม่มีก็ใบของรอบถัดไปที่ใกล้ที่สุด
  const requestFor = (due: ISODate) =>
    requests.find((r) => monthKey(r.dueDate) === monthKey(due)) ??
    requests.filter((r) => monthKey(r.dueDate) > monthKey(due)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const result = (state: CenterSummaryState, dueDate: ISODate, request?: SummaryRequest): CenterSummaryResult => ({
    state,
    dueDate,
    daysLeft: daysUntil(today, dueDate),
    ...(request && { request }),
  });

  const current = requestFor(thisDue);
  if (!current) {
    const daysLeft = daysUntil(today, thisDue);
    if (daysLeft < 0) return result("OVERDUE", thisDue);
    return result(daysLeft <= DUE_SOON_DAYS ? "DUE_SOON" : "NOT_YET", thisDue);
  }

  // เดือนนี้เบิกแล้ว — ถ้าเดือนหน้าใกล้ถึงกำหนดแล้วแต่ยังไม่เบิก ให้เตือนล่วงหน้า
  if (!requestFor(nextDue) && daysUntil(today, nextDue) <= DUE_SOON_DAYS) return result("DUE_SOON", nextDue);
  // ใบของรอบที่ใหม่กว่า → แสดงวันครบกำหนดของใบนั้น (ไม่ใช่ของเดือนนี้ที่ไม่มีใบ)
  const shownDue = monthKey(current.dueDate) === monthKey(thisDue) ? thisDue : current.dueDate;
  return result("REQUESTED", shownDue, current);
}

// ลำดับในตาราง: เลยกำหนด → ใกล้ครบ (เหลือน้อยก่อน) → ยังไม่ถึงรอบ → เบิกแล้ว
const STATE_ORDER: Record<CenterSummaryState, number> = { OVERDUE: 0, DUE_SOON: 1, NOT_YET: 2, REQUESTED: 3 };

export function compareSummaries(a: CenterSummaryResult, b: CenterSummaryResult): number {
  return STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.daysLeft - b.daysLeft;
}
