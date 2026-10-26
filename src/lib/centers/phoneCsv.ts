import { parseAmount } from "@/lib/money";
import { readCsvTable, type CenterRow } from "./parseCentersCsv";
import { DEFAULT_PROVIDER, formatPhone, normalizePhone } from "./phone";

// แปลงไฟล์ CSV ทะเบียนเบอร์โทรศัพท์ → แถวในตาราง Center (kind = PHONE) พร้อม upsert
// customerCode = หมายเลขโทรศัพท์ (ตัวเลขล้วน), serviceNumber = รหัสลูกค้าของค่าย — ดูคำอธิบายใน schema.prisma

export type PhoneRow = CenterRow & { kind: "PHONE"; provider: string };

type Field = "phoneNumber" | "provider" | "accountCode" | "name" | "normalAmount" | "dueDay" | "status";

const HEADER_ALIASES: Record<Field, string[]> = {
  phoneNumber: ["หมายเลขโทรศัพท์", "เบอร์โทรศัพท์", "เบอร์โทร", "เบอร์", "phone"],
  provider: ["ระบบ", "ค่าย", "provider"],
  accountCode: ["รหัสลูกค้า", "customercode"],
  name: ["ผู้ใช้บริการ", "ผู้ใช้", "ฝ่าย", "name"],
  normalAmount: ["ยอดปกติ", "normalamount", "amount"],
  dueDay: ["วันครบกำหนด", "วันครบกำหนดประจำเดือน", "dueday"],
  status: ["สถานะ", "status"],
};

const REQUIRED: Field[] = ["phoneNumber", "name", "normalAmount", "dueDay"];

const STATUS_MAP: Record<string, "ACTIVE" | "CLOSED"> = {
  ใช้งาน: "ACTIVE",
  active: "ACTIVE",
  ยกเลิก: "CLOSED",
  ปิด: "CLOSED",
  closed: "CLOSED",
};

export function parsePhonesCsv(text: string): { rows: PhoneRow[]; errors: string[] } {
  const { data, cell, errors } = readCsvTable(text, HEADER_ALIASES, REQUIRED);
  if (errors.length) return { rows: [], errors };

  const rows: PhoneRow[] = [];
  const seen = new Map<string, number>();

  data.forEach((record, i) => {
    const line = i + 2; // บรรทัด 1 = หัวคอลัมน์
    const rowErrors: string[] = [];

    const phoneRaw = cell(record, "phoneNumber");
    const phone = normalizePhone(phoneRaw);
    const name = cell(record, "name");
    const normalAmount = parseAmount(cell(record, "normalAmount"));
    const dueDayRaw = cell(record, "dueDay");
    const dueDay = Number(dueDayRaw);
    const statusRaw = cell(record, "status");
    const status = statusRaw === "" ? "ACTIVE" : STATUS_MAP[statusRaw.toLowerCase()];

    if (!phone) rowErrors.push(phoneRaw ? `หมายเลขโทรศัพท์ไม่ถูกต้อง "${phoneRaw}"` : "ไม่มีหมายเลขโทรศัพท์");
    if (!name) rowErrors.push("ไม่มีผู้ใช้บริการ");
    if (normalAmount === null) rowErrors.push(`ยอดปกติไม่ถูกต้อง "${cell(record, "normalAmount")}"`);
    if (!/^\d+$/.test(dueDayRaw) || dueDay < 1 || dueDay > 31) rowErrors.push(`วันครบกำหนดต้องเป็นเลข 1-31 แต่ได้ "${dueDayRaw}"`);
    if (!status) rowErrors.push(`สถานะไม่รู้จัก "${statusRaw}" (ใช้ได้: ใช้งาน / ยกเลิก)`);

    if (phone) {
      const firstLine = seen.get(phone);
      if (firstLine) rowErrors.push(`เบอร์ ${formatPhone(phone)} ซ้ำกับบรรทัด ${firstLine}`);
      else seen.set(phone, line);
    }

    if (rowErrors.length) {
      errors.push(`บรรทัด ${line}: ${rowErrors.join(", ")}`);
      return;
    }

    rows.push({
      kind: "PHONE",
      customerCode: phone!,
      serviceNumber: cell(record, "accountCode") || null,
      provider: (cell(record, "provider") || DEFAULT_PROVIDER).toUpperCase(),
      name,
      normalAmount: normalAmount!,
      dueDay,
      status: status!,
    });
  });

  return { rows, errors };
}
