// วันที่ในแอปเป็นข้อความ ISO "YYYY-MM-DD" (ค.ศ.) ตรงกับคอลัมน์ @db.Date
// Prisma คืน @db.Date เป็น Date เวลา 00:00 UTC จึงต้องอ่านส่วน UTC เสมอ

export type ISODate = string;

const TIME_ZONE = "Asia/Bangkok";
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS_LONG = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export function isISODate(s: string): boolean {
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function parts(iso: ISODate): { y: number; m: number; d: number } {
  if (!isISODate(iso)) throw new Error(`วันที่ไม่ถูกต้อง: ${iso}`);
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

// Date จาก Prisma (@db.Date) → "YYYY-MM-DD"
export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

// "YYYY-MM-DD" → Date 00:00 UTC สำหรับเขียนลง @db.Date
export function fromISODate(iso: ISODate): Date {
  const { y, m, d } = parts(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

// วันนี้ตามเวลาไทย
export function todayISO(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

// ชั่วโมงตามเวลาไทย 0–23 (คำทักทายตามช่วงเวลา)
export function thaiHour(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(now));
}

// เวลาไทย "10:30" (เวลาเหตุการณ์ เช่น อนุมัติในระบบ)
export function formatThaiTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

export function addDays(iso: ISODate, days: number): ISODate {
  return toISODate(new Date(fromISODate(iso).getTime() + days * DAY_MS));
}

// จำนวนวันนับรวมวันแรกและวันสุดท้าย เช่น 1 ก.ย. – 30 ก.ย. = 30 วัน
export function daysInclusive(start: ISODate, end: ISODate): number {
  return Math.round((fromISODate(end).getTime() - fromISODate(start).getTime()) / DAY_MS) + 1;
}

// ช่วงวันที่ทับกันหรือไม่ (นับวันขอบด้วย) — ตรงกับ daterange '[]' && ใน DB
export function periodsOverlap(aStart: ISODate, aEnd: ISODate, bStart: ISODate, bEnd: ISODate): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

// หน้าจอ: พ.ศ. เช่น "21 ต.ค. 2569" หรือ "21 ตุลาคม 2569"
export function formatThaiDate(iso: ISODate, month: "short" | "long" = "short"): string {
  const { y, m, d } = parts(iso);
  const name = (month === "long" ? MONTHS_LONG : MONTHS_SHORT)[m - 1];
  return `${d} ${name} ${y + 543}`;
}

// เวลาเหตุการณ์ (เช่น ประวัติใบเบิก) ตามเวลาไทย: "21 ต.ค. 2569 14:05"
export function formatThaiDateTime(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${formatThaiDate(`${parts.year}-${parts.month}-${parts.day}`)} ${parts.hour}:${parts.minute}`;
}

// ---------- เดือน "YYYY-MM" (เวลาไทย) — ดูใบเบิกตามเดือนที่สร้าง ----------

export const isMonthKey = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

// ช่วงเวลาของเดือนตามเวลาไทย (UTC+7 ไม่มีเวลาออมแสง) สำหรับกรองคอลัมน์ timestamp เช่น createdAt
export function monthRange(month: string): { gte: Date; lt: Date } {
  const [y, m] = month.split("-").map(Number);
  const offset = 7 * 60 * 60 * 1000;
  return { gte: new Date(Date.UTC(y, m - 1, 1) - offset), lt: new Date(Date.UTC(y, m, 1) - offset) };
}

// "ตุลาคม 2569"
export function formatThaiMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y + 543}`;
}

// เดือนตั้งแต่ from ถึง to (รวมทั้งสองเดือน) ใหม่สุดก่อน — ตัวเลือกเดือนในหน้าใบเบิก
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = to.split("-").map(Number);
  while (`${y}-${String(m).padStart(2, "0")}` >= from) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (--m === 0) [y, m] = [y - 1, 12];
  }
  return out;
}

// ใบเบิก (บันทึกภายใน FM-50000-02) ใช้ พ.ศ. ทั้งหมด

// "12/11/2569"
export function formatBEDate(iso: ISODate): string {
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
}

// "พฤศจิกายน"
export function thaiMonthName(iso: ISODate): string {
  return MONTHS_LONG[parts(iso).m - 1];
}

// ปี พ.ศ. ของวันที่ เช่น 2569
export function beYear(iso: ISODate): number {
  return parts(iso).y + 543;
}

// ---------- ช่องกรอกวันที่แบบไทย (วว/ดด/ปปปป พ.ศ.) ----------

// "2026-10-04" → "04/10/2569" (ค่าว่าง/ไม่ถูกต้อง → "")
export function formatBEInput(iso: ISODate): string {
  return isISODate(iso) ? formatBEDate(iso) : "";
}

// "4/10/2569" → "2026-10-04"; ปี ≥ 2400 ถือเป็น พ.ศ., ปี 1900–2399 ถือเป็น ค.ศ. (เผื่อพิมพ์ ค.ศ.)
// รูปแบบผิดหรือวันที่ไม่มีจริง (31/02) → null
export function parseBEInput(text: string): ISODate | null {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text.trim());
  if (!m) return null;
  const year = +m[3] >= 2400 ? +m[3] - 543 : +m[3];
  if (year < 1900) return null;
  const iso = `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isISODate(iso) ? iso : null;
}

// จัดรูปขณะพิมพ์: เหลือแต่ตัวเลข แล้วใส่ / ให้เอง ("04102569" → "04/10/2569")
export function maskBEInput(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

// ช่วงวันที่แบบสั้น: ปีเดียวกันพิมพ์ปีครั้งเดียว "21 ก.ย. – 20 ต.ค. 2569" / ข้ามปี "16 ธ.ค. 2569 – 15 ม.ค. 2570"
export function formatThaiDateRange(start: ISODate, end: ISODate): string {
  const a = formatThaiDate(start);
  const b = formatThaiDate(end);
  return start.slice(0, 4) === end.slice(0, 4) ? `${a.replace(/ \d{4}$/, "")} – ${b}` : `${a} – ${b}`;
}
