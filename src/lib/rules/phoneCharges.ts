import { parseAmount, toSatang } from "@/lib/money";

// ยอดใบเบิกค่าโทรศัพท์ตามบิล: ผู้จัดทำกรอกยอดก่อน VAT 2 ช่อง แล้วระบบคิดต่อ (ผู้ใช้เลือก 2026-10-26)
// ตัวอย่างบิล True: แพ็กเกจหลัก 350.00 + เสริม/ส่วนเกิน 31.68 = 381.68, VAT 7% 26.72, รวม 408.40
// คิดเป็นสตางค์ทั้งหมด (ห้าม float); VAT ปัดครึ่งขึ้นเป็นสตางค์ (381.68 × 7% = 26.7176 → 26.72)

export const VAT_PERCENT = 7;

export type PhoneCharges = {
  packageAmount: string; // ค่าบริการแพ็กเกจหลัก (ก่อน VAT)
  extraAmount: string; // ค่าบริการแพ็กเกจเสริมและค่าบริการส่วนเกิน (ก่อน VAT)
  subtotal: string; // รวมค่าบริการก่อนภาษีมูลค่าเพิ่ม
  vat: string;
  total: string; // = ยอดเบิก (amount)
};

const HUNDRED = BigInt(100);
const fromSatang = (satang: bigint) => `${satang / HUNDRED}.${String(satang % HUNDRED).padStart(2, "0")}`;
const divRound = (n: bigint, d: bigint) => (n * BigInt(2) + d) / (d * BigInt(2)); // ปัดครึ่งขึ้น (n, d ไม่ติดลบ)

// ช่องเสริม/ส่วนเกินเว้นว่าง = 0; รูปแบบผิด/ติดลบ → null
export function phoneCharges(packageRaw: string, extraRaw: string): PhoneCharges | null {
  const packageAmount = parseAmount(packageRaw);
  const extraAmount = parseAmount(extraRaw.trim() === "" ? "0" : extraRaw);
  if (packageAmount === null || extraAmount === null) return null;

  const subtotal = toSatang(packageAmount) + toSatang(extraAmount);
  const vat = divRound(subtotal * BigInt(VAT_PERCENT), HUNDRED);
  return { packageAmount, extraAmount, subtotal: fromSatang(subtotal), vat: fromSatang(vat), total: fromSatang(subtotal + vat) };
}

// ค่าแพ็กเกจก่อน VAT จากยอดปกติในทะเบียนเบอร์ (รวม VAT) — ใช้กรอกให้ล่วงหน้า: 374.50 → 350.00
export function packageFromNormal(normalAmount: string): string {
  return fromSatang(divRound(toSatang(normalAmount) * HUNDRED, BigInt(100 + VAT_PERCENT)));
}

// ยอดแยกของใบเบิกที่บันทึกแล้ว (ค่าอินเทอร์เน็ต/ใบเก่าที่ไม่มีข้อมูล → null)
export function storedCharges(request: {
  packageAmount: { toFixed(dp: number): string } | null;
  extraAmount: { toFixed(dp: number): string } | null;
}): PhoneCharges | null {
  if (!request.packageAmount || !request.extraAmount) return null;
  return phoneCharges(request.packageAmount.toFixed(2), request.extraAmount.toFixed(2));
}
