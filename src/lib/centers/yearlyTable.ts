import type { CenterStatus, ServiceKind } from "@/generated/prisma/enums";
import { parseAmount } from "@/lib/money";
import { isISODate, toISODate, type ISODate } from "@/lib/thai/date";
import { normalizePhone } from "./phone";

// อ่าน "ตารางรายปี" จากไฟล์ Excel (แบบกระดาษที่เคยเขียนมือ / ไฟล์ที่ดาวน์โหลดจากระบบ) → ทะเบียน + ประวัติบิลย้อนหลัง
// หน้าตาที่รองรับ: หัวตาราง 2 แถว
//   แถวบน: ลำดับ | ชื่อศูนย์ | หมายเลขบริการ | รหัสลูกค้า | <เดือน> (คลุม 3 ช่อง) | ...
//   แถวล่าง:                                         | ค่าบริการ | กำหนดชำระ | รอบค่าบริการ | ...
// แต่ละเดือนที่กรอก = 1 บิลย้อนหลัง; เขียน "ย้ายศูนย์" / "ปิด" / "ยกเลิก" ในช่องเดือน = สถานะของศูนย์
// ยอดปกติ/วันครบกำหนด = ค่าบริการ/วันที่ของบิลล่าสุดในไฟล์; แถวที่ขึ้นต้นด้วย "รวม" = จบตาราง
// ไม่แตะ DB — คืน error ทุกจุดเพื่อให้แก้ไฟล์ได้ในรอบเดียว

export type TableCenter = {
  line: number;
  customerCode: string; // อินเทอร์เน็ต = รหัสลูกค้า, โทรศัพท์ = หมายเลข (ตัวเลขล้วน)
  serviceNumber: string | null; // อินเทอร์เน็ต = หมายเลขบริการ, โทรศัพท์ = รหัสลูกค้าของค่าย
  name: string;
  normalAmount: string | null; // จากบิลล่าสุด (ไม่มีบิล = null)
  dueDay: number | null;
  status: CenterStatus | null; // null = ไม่ได้ระบุ (คงสถานะเดิม / ศูนย์ใหม่ = ใช้งาน)
};

export type TableBill = {
  line: number;
  month: string; // ชื่อเดือนตามหัวตาราง (ไว้แจ้งผู้ใช้)
  customerCode: string;
  amount: string; // "749.00"
  dueDate: ISODate;
  periodStart: ISODate;
  periodEnd: ISODate;
};

export type YearlyTableResult = { centers: TableCenter[]; bills: TableBill[]; errors: string[] };

// หัวคอลัมน์ทางซ้าย (เทียบแบบตัดช่องว่าง) — คำแรกที่ตรงก่อน
const FIXED_HEADERS: Record<ServiceKind, { name: string[]; code: string[]; extra: string[] }> = {
  INTERNET: { name: ["ชื่อศูนย์", "ชื่อ", "ศูนย์"], code: ["รหัสลูกค้า"], extra: ["หมายเลขบริการ"] },
  PHONE: { name: ["ผู้ใช้บริการ", "ผู้ใช้", "ชื่อ"], code: ["หมายเลขโทรศัพท์", "เบอร์โทรศัพท์", "เบอร์โทร", "เบอร์"], extra: ["รหัสลูกค้า"] },
};

const MARKERS: { re: RegExp; status: Record<ServiceKind, CenterStatus> }[] = [
  { re: /ย้าย/, status: { INTERNET: "MOVED", PHONE: "CLOSED" } }, // เบอร์ไม่มีสถานะย้าย
  { re: /ปิด|ยกเลิก/, status: { INTERNET: "CLOSED", PHONE: "CLOSED" } },
];

const squash = (s: string) => s.replace(/\s+/g, "");
const colName = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : colName(Math.floor(i / 26) - 1) + colName(i % 26));

// ค่าในเซลล์เป็นข้อความ (ตัวเลขอ่านมาเป็นข้อความอยู่แล้ว — parseNumber ของ read-excel-file)
function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return toISODate(v);
  return String(v).trim();
}

// วันที่ในตาราง: "24/09/2569", "24/9/69" (ปี 2 หลัก = พ.ศ. 25xx), "24/09/2026", วันที่ของ Excel (Date / เลขลำดับวัน)
export function parseTableDate(v: unknown): ISODate | null {
  if (v instanceof Date) return fromYMD(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  const s = cellText(v);
  if (/^\d{5}(\.0+)?$/.test(s)) {
    // เลขลำดับวันของ Excel (นับจาก 30 ธ.ค. 1899) — เซลล์ที่ Excel แปลงเป็นวันที่แต่รูปแบบไม่มาตรฐาน
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86_400_000);
    return fromYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (!m) return null;
  const year = m[3].length === 2 ? 2500 + Number(m[3]) : Number(m[3]);
  return fromYMD(year, Number(m[2]), Number(m[1]));
}

// ปี ≥ 2400 = พ.ศ.
function fromYMD(year: number, month: number, day: number): ISODate | null {
  const y = year >= 2400 ? year - 543 : year;
  const iso = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return y >= 1900 && isISODate(iso) ? iso : null;
}

// รอบค่าบริการ: "24/08/69-23/09/69", "24/08/2569 – 23/09/2569", "24/08/69 ถึง 23/09/69"
export function parseTablePeriod(v: unknown): { start: ISODate; end: ISODate } | null {
  const m = /^(\S+?)\s*(?:-|–|—|~|ถึง)\s*(\S+)$/.exec(cellText(v));
  if (!m) return null;
  const start = parseTableDate(m[1]);
  const end = parseTableDate(m[2]);
  return start && end ? { start, end } : null;
}

export function parseYearlyTable(data: unknown[][], kind: ServiceKind): YearlyTableResult {
  const rows = data.map((r) => r.map(cellText));
  const subRow = rows.findIndex((r) => r.some((c) => squash(c) === "ค่าบริการ"));
  if (subRow < 1) {
    return { centers: [], bills: [], errors: ['ไม่พบหัวตาราง "ค่าบริการ / กำหนดชำระ / รอบค่าบริการ" — ใช้ไฟล์ตัวอย่างของระบบ (ตารางรายปี)'] };
  }
  const head = rows[subRow - 1];

  // คอลัมน์ซ้าย: หาในแถวบนก่อน (เซลล์ที่คลุม 2 แถว ค่าอยู่แถวบน) ถ้าไม่เจอดูแถวล่าง
  const findColumn = (names: string[]) => {
    for (const line of [head, rows[subRow]]) {
      for (const name of names) {
        const i = line.findIndex((c) => squash(c) === name);
        if (i >= 0) return i;
      }
    }
    return -1;
  };
  const labels = FIXED_HEADERS[kind];
  const col = { name: findColumn(labels.name), code: findColumn(labels.code), extra: findColumn(labels.extra) };
  const missing = [col.name < 0 && labels.name[0], col.code < 0 && labels.code[0]].filter(Boolean);
  if (missing.length) return { centers: [], bills: [], errors: [`ไม่พบคอลัมน์ ${missing.join(", ")} ในหัวตาราง`] };

  // เดือน: ทุกคอลัมน์ "ค่าบริการ" ในแถวล่าง ตามด้วย กำหนดชำระ / รอบค่าบริการ
  const months: { amount: number; due: number; period: number; label: string }[] = [];
  const errors: string[] = [];
  rows[subRow].forEach((c, i) => {
    if (squash(c) !== "ค่าบริการ") return;
    const label = head[i] || `คอลัมน์ ${colName(i)}`;
    if (!squash(rows[subRow][i + 1] ?? "").includes("กำหนด") || !squash(rows[subRow][i + 2] ?? "").includes("รอบ")) {
      errors.push(`หัวตารางเดือน${label}: ถัดจาก "ค่าบริการ" ต้องเป็น "กำหนดชำระ" และ "รอบค่าบริการ"`);
      return;
    }
    months.push({ amount: i, due: i + 1, period: i + 2, label });
  });

  const centers: TableCenter[] = [];
  const bills: TableBill[] = [];
  const seen = new Map<string, number>();

  for (let r = subRow + 1; r < rows.length; r++) {
    const row = rows[r];
    const line = r + 1;
    if (row.every((c) => c === "")) continue;
    if (/^รวม/.test(row.find((c) => c !== "") ?? "")) break;

    const rowErrors: string[] = [];
    const name = row[col.name] ?? "";
    const rawCode = squash(row[col.code] ?? "");
    const code = kind === "PHONE" ? normalizePhone(rawCode) : rawCode;
    if (!name) rowErrors.push(`ไม่มี${labels.name[0]}`);
    if (!rawCode) rowErrors.push(`ไม่มี${labels.code[0]}`);
    else if (!code) rowErrors.push(`หมายเลขโทรศัพท์ไม่ถูกต้อง "${rawCode}"`);
    if (code && seen.has(code)) rowErrors.push(`${labels.code[0]} ${rawCode} ซ้ำกับบรรทัด ${seen.get(code)}`);

    let status: CenterStatus | null = null;
    const rowBills: TableBill[] = [];
    for (const m of months) {
      const cells = [row[m.amount] ?? "", row[m.due] ?? "", row[m.period] ?? ""];
      const marker = MARKERS.find((k) => cells.some((c) => k.re.test(c)));
      if (marker) {
        status = marker.status[kind];
        continue;
      }
      if (cells.every((c) => c === "")) continue;

      // Excel เก็บทศนิยมแบบเลขฐานสอง (631.3 → "631.29999999999995") — ปัดเป็น 2 ตำแหน่งก่อน
      const amount = parseAmount(/^\d+\.\d{3,}$/.test(cells[0]) ? Number(cells[0]).toFixed(2) : cells[0]);
      const dueDate = parseTableDate(data[r][m.due]);
      const period = parseTablePeriod(cells[2]);
      const where = `เดือน${m.label}`;
      if (!amount || amount === "0.00") rowErrors.push(`${where}: ค่าบริการไม่ถูกต้อง "${cells[0]}"`);
      if (!dueDate) rowErrors.push(`${where}: กำหนดชำระไม่ถูกต้อง "${cells[1]}" (ใช้ วว/ดด/ปปปป เช่น 24/09/2569)`);
      if (!period) rowErrors.push(`${where}: รอบค่าบริการไม่ถูกต้อง "${cells[2]}" (เช่น 24/08/69-23/09/69)`);
      else if (period.end < period.start) rowErrors.push(`${where}: รอบค่าบริการวันสิ้นสุดก่อนวันเริ่ม`);
      if (amount && dueDate && period && code) {
        rowBills.push({ line, month: m.label, customerCode: code, amount, dueDate, periodStart: period.start, periodEnd: period.end });
      }
    }

    if (rowErrors.length) {
      errors.push(`บรรทัด ${line}${name ? ` (${name})` : ""}: ${rowErrors.join(", ")}`);
      continue;
    }
    seen.set(code!, line);
    const latest = rowBills.reduce<TableBill | null>((a, b) => (!a || b.dueDate > a.dueDate ? b : a), null);
    centers.push({
      line,
      customerCode: code!,
      serviceNumber: (col.extra >= 0 && row[col.extra]) || null,
      name,
      normalAmount: latest?.amount ?? null,
      dueDay: latest ? Number(latest.dueDate.slice(8, 10)) : null,
      status,
    });
    bills.push(...rowBills);
  }

  if (errors.length === 0 && centers.length === 0) errors.push("ไม่พบข้อมูลในตาราง");
  return { centers, bills, errors };
}

// ---------- บิลย้อนหลัง → ใบเบิก "จ่ายแล้ว" ----------

export const IMPORTED_INVOICE_NO = "(ย้อนหลัง)"; // ตารางเดิมไม่มีเลขที่ใบแจ้งหนี้
export const IMPORTED_PAYMENT_REF = "นำเข้าจากตารางเดิม";

type Period = { start: ISODate; end: ISODate };
const overlaps = (a: Period, b: Period) => a.start <= b.end && b.start <= a.end; // รวมวันขอบ (เหมือน Request_no_overlap)

// แยกบิลที่สร้างได้ / ข้าม: รอบทับกับใบเดิมของศูนย์นั้น หรือทับกับบิลก่อนหน้าในไฟล์ → ข้าม (ไม่ใช่ error — นำเข้าไฟล์เดิมซ้ำได้)
export function planBills(bills: TableBill[], existing: Map<string, Period[]>): { create: TableBill[]; skipped: TableBill[] } {
  const taken = new Map([...existing].map(([code, periods]) => [code, [...periods]]));
  const create: TableBill[] = [];
  const skipped: TableBill[] = [];
  for (const bill of [...bills].sort((a, b) => a.periodStart.localeCompare(b.periodStart))) {
    const period = { start: bill.periodStart, end: bill.periodEnd };
    const periods = taken.get(bill.customerCode) ?? [];
    if (periods.some((p) => overlaps(p, period))) {
      skipped.push(bill);
      continue;
    }
    periods.push(period);
    taken.set(bill.customerCode, periods);
    create.push(bill);
  }
  return { create, skipped };
}
