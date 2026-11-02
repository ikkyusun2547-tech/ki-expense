// เงินในระบบเป็นทศนิยม 2 ตำแหน่ง (Decimal(12,2)) — ห้ามคำนวณด้วย float
// ภายในแอปส่งต่อกันเป็นข้อความ "1068.93"; Prisma Decimal / number ใช้ toFixed(2) แปลงเข้ามา

export type AmountInput = string | number | { toFixed(dp: number): string };

// "1,068.93" / "749" / "749.5" → "1068.93" / "749.00" / "749.50"; รูปแบบผิดหรือติดลบ → null
export function parseAmount(raw: string): string | null {
  const s = raw.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, frac = ""] = s.split(".");
  return `${BigInt(int).toString()}.${frac.padEnd(2, "0")}`;
}

export function toAmountString(input: AmountInput): string {
  const raw = typeof input === "string" ? input : input.toFixed(2);
  const amount = parseAmount(raw);
  if (amount === null) throw new Error(`ยอดเงินไม่ถูกต้อง: ${raw}`);
  return amount;
}

// หน่วยสตางค์ ใช้เปรียบเทียบ/บวกลบโดยไม่เสียความแม่นยำ
export function toSatang(input: AmountInput): bigint {
  return BigInt(toAmountString(input).replace(".", ""));
}

// "1068.93" → "1,068.93"
export function formatAmount(input: AmountInput): string {
  const [int, frac] = toAmountString(input).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
}

// สตางค์ → "1068.93" (ใช้กับยอดรวมที่บวกด้วย toSatang)
export function fromSatang(satang: bigint): string {
  const sign = satang < BigInt(0) ? "-" : "";
  const abs = satang < BigInt(0) ? -satang : satang;
  return `${sign}${abs / BigInt(100)}.${String(abs % BigInt(100)).padStart(2, "0")}`;
}
