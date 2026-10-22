import { parse } from "csv-parse/sync";
import type { CenterStatus } from "@/generated/prisma/enums";
import { parseAmount } from "@/lib/money";

// แปลงไฟล์ CSV ทะเบียนศูนย์เป็นข้อมูลพร้อม upsert
// ไม่แตะ DB — ตรวจทั้งไฟล์แล้วคืน error ทุกบรรทัด เพื่อให้แก้ไฟล์ได้ในรอบเดียว

export type CenterRow = {
  customerCode: string;
  serviceNumber: string | null;
  name: string;
  normalAmount: string; // ทศนิยม 2 ตำแหน่งเป็นข้อความ เช่น "749.00" (ส่งเข้า Prisma Decimal ตรง ๆ)
  dueDay: number;
  status: CenterStatus;
};

export type ParseResult = {
  rows: CenterRow[];
  errors: string[];
};

type Field = keyof CenterRow;

// ชื่อหัวคอลัมน์ที่ยอมรับ (เทียบแบบตัดช่องว่าง ไม่สนตัวพิมพ์)
// TODO: ปรับให้ตรงกับไฟล์ CSV จริงของผู้ใช้
const HEADER_ALIASES: Record<Field, string[]> = {
  customerCode: ["รหัสลูกค้า", "customercode", "customer_code"],
  serviceNumber: ["หมายเลขบริการ", "servicenumber", "service_number"],
  name: ["ชื่อศูนย์", "ศูนย์", "name"],
  normalAmount: ["ยอดปกติ", "normalamount", "normal_amount", "amount"],
  dueDay: ["วันครบกำหนด", "วันครบกำหนดประจำเดือน", "dueday", "due_day"],
  status: ["สถานะ", "status"],
};

const REQUIRED: Field[] = ["customerCode", "name", "normalAmount", "dueDay"];

const STATUS_MAP: Record<string, CenterStatus> = {
  ใช้งาน: "ACTIVE",
  active: "ACTIVE",
  ย้าย: "MOVED",
  moved: "MOVED",
  ปิด: "CLOSED",
  closed: "CLOSED",
};

const normalizeHeader = (h: string) => h.replace(/\s+/g, "").toLowerCase();

function mapHeaders(headers: string[]): { index: Partial<Record<Field, number>>; errors: string[] } {
  const index: Partial<Record<Field, number>> = {};
  const normalized = headers.map(normalizeHeader);

  for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
    const aliases = HEADER_ALIASES[field].map(normalizeHeader);
    const found = normalized.findIndex((h) => aliases.includes(h));
    if (found >= 0) index[field] = found;
  }

  const errors = REQUIRED.filter((f) => index[f] === undefined).map(
    (f) => `ไม่พบคอลัมน์ "${HEADER_ALIASES[f][0]}" (หัวคอลัมน์ที่พบ: ${headers.join(", ")})`,
  );
  return { index, errors };
}

export function parseCentersCsv(text: string): ParseResult {
  const records: string[][] = parse(text.replace(/^﻿/, ""), {
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
  if (records.length === 0) return { rows: [], errors: ["ไฟล์ว่าง"] };

  const [headers, ...data] = records;
  const { index, errors } = mapHeaders(headers);
  if (errors.length) return { rows: [], errors };

  const cell = (record: string[], field: Field) => {
    const i = index[field];
    return i === undefined ? "" : (record[i] ?? "").trim();
  };

  const rows: CenterRow[] = [];
  const seenCodes = new Map<string, number>();

  data.forEach((record, i) => {
    const line = i + 2; // บรรทัดในไฟล์ (บรรทัด 1 = หัวคอลัมน์)
    const rowErrors: string[] = [];

    const customerCode = cell(record, "customerCode");
    const name = cell(record, "name");
    const normalAmount = parseAmount(cell(record, "normalAmount"));
    const dueDayRaw = cell(record, "dueDay");
    const dueDay = Number(dueDayRaw);
    const statusRaw = cell(record, "status");
    const status = statusRaw === "" ? "ACTIVE" : STATUS_MAP[statusRaw.toLowerCase()];

    if (!customerCode) rowErrors.push("ไม่มีรหัสลูกค้า");
    if (!name) rowErrors.push("ไม่มีชื่อศูนย์");
    if (normalAmount === null) rowErrors.push(`ยอดปกติไม่ถูกต้อง "${cell(record, "normalAmount")}"`);
    if (!/^\d+$/.test(dueDayRaw) || dueDay < 1 || dueDay > 31)
      rowErrors.push(`วันครบกำหนดต้องเป็นเลข 1-31 แต่ได้ "${dueDayRaw}"`);
    if (!status) rowErrors.push(`สถานะไม่รู้จัก "${statusRaw}" (ใช้ได้: ใช้งาน / ย้าย / ปิด)`);

    if (customerCode) {
      const firstLine = seenCodes.get(customerCode);
      if (firstLine) rowErrors.push(`รหัสลูกค้า ${customerCode} ซ้ำกับบรรทัด ${firstLine}`);
      else seenCodes.set(customerCode, line);
    }

    if (rowErrors.length) {
      errors.push(`บรรทัด ${line}: ${rowErrors.join(", ")}`);
      return;
    }

    rows.push({
      customerCode,
      serviceNumber: cell(record, "serviceNumber") || null,
      name,
      normalAmount: normalAmount!,
      dueDay,
      status: status!,
    });
  });

  return { rows, errors };
}

// Excel บน Windows มักบันทึก CSV ภาษาไทยเป็น windows-874 แทน UTF-8
export function decodeCsvBuffer(buf: Uint8Array): { text: string; encoding: "utf-8" | "windows-874" } {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buf), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-874").decode(buf), encoding: "windows-874" };
  }
}
