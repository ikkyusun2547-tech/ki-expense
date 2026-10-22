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

// ใบเบิก PDF: ค.ศ. ตามฟอร์มเดิม เช่น "21/10/2026"
// TODO(เฟส 4): ตรวจรูปแบบกับฟอร์มกระดาษ/prototype อีกครั้ง
export function formatCEDate(iso: ISODate): string {
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
