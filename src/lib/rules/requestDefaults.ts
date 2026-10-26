import { dueDateInMonth } from "@/lib/rules/centerSummary";
import { addDays, type ISODate } from "@/lib/thai/date";

// ค่าที่กรอกให้ล่วงหน้าในฟอร์มสร้างใบเบิก (ผู้จัดทำแก้ได้ถ้าไม่ตรงใบแจ้งหนี้)
// - ยอด = ยอดปกติของศูนย์
// - มีใบเบิกก่อนหน้า → รอบบริการต่อจากใบล่าสุด 1 เดือน, ครบกำหนด = วันครบกำหนดของศูนย์ในเดือนถัดจากใบล่าสุด
// - ยังไม่เคยเบิก → เว้นรอบบริการให้กรอกเอง, ครบกำหนด = วันครบกำหนดของศูนย์ในเดือนนี้
//   ถ้าวันนั้นผ่านไปแล้ว → เดือนถัดไป (บิลที่เพิ่งได้มามักยังไม่ถึงกำหนด — ผู้ใช้เลือก 2026-10-26)

export type RequestSuggestion = {
  amount: string;
  periodStart: ISODate | "";
  periodEnd: ISODate | "";
  dueDate: ISODate;
};

export type LastRequest = { periodEnd: ISODate; dueDate: ISODate };

const ymd = (iso: ISODate) => iso.split("-").map(Number) as [number, number, number];
const nextMonth = (y: number, m: number): [number, number] => (m === 12 ? [y + 1, 1] : [y, m + 1]);
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// วันเดียวกันของเดือนถัดไป; ถ้าเป็นวันสุดท้ายของเดือน → วันสุดท้ายของเดือนถัดไป (31 ต.ค. → 30 พ.ย.)
export function sameDayNextMonth(iso: ISODate): ISODate {
  const [y, m, d] = ymd(iso);
  const [ny, nm] = nextMonth(y, m);
  return dueDateInMonth(ny, nm, d === lastDayOf(y, m) ? 31 : d);
}

export function suggestRequest(
  center: { normalAmount: string; dueDay: number },
  last: LastRequest | null,
  today: ISODate,
): RequestSuggestion {
  if (!last) {
    const [y, m] = ymd(today);
    const thisMonth = dueDateInMonth(y, m, center.dueDay);
    const dueDate = thisMonth < today ? dueDateInMonth(...nextMonth(y, m), center.dueDay) : thisMonth;
    return { amount: center.normalAmount, periodStart: "", periodEnd: "", dueDate };
  }
  const [dy, dm] = ymd(last.dueDate);
  const [ny, nm] = nextMonth(dy, dm);
  return {
    amount: center.normalAmount,
    periodStart: addDays(last.periodEnd, 1),
    periodEnd: sameDayNextMonth(last.periodEnd),
    dueDate: dueDateInMonth(ny, nm, center.dueDay),
  };
}
