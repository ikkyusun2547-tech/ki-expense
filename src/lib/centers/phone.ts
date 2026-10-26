// หมายเลขโทรศัพท์ในทะเบียนเก็บเป็นตัวเลขล้วน (ใช้เป็นรหัสค้นหา) และแสดงแบบมีขีดตามฟอร์มบันทึกภายใน

export const DEFAULT_PROVIDER = "TRUE";
export const PROVIDER_SUGGESTIONS = ["TRUE", "AIS", "DTAC", "NT"];

// รับได้หลายรูปแบบ: 097-3378822, 097 337 8822, +66 97 337 8822
// Excel มักตัดเลข 0 ตัวหน้าทิ้ง (973378822) → เติมกลับให้ เพราะเบอร์ไทยขึ้นต้นด้วย 0 เสมอ
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+66")) digits = "0" + digits.slice(3);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith("66") && digits.length === 11) digits = "0" + digits.slice(2);
  if (!digits.startsWith("0") && (digits.length === 8 || digits.length === 9)) digits = "0" + digits;
  return /^0\d{8,9}$/.test(digits) ? digits : null;
}

// มือถือ 10 หลัก: 097-3378822 (ตามฟอร์มจริง) / กรุงเทพฯ 9 หลัก: 02-1234567 / ต่างจังหวัด 9 หลัก: 044-123456
export function formatPhone(digits: string): string {
  if (!/^0\d{8,9}$/.test(digits)) return digits;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.startsWith("02")) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

// ป้ายประเภทในแถวรายการ — แสดงเฉพาะค่าโทรศัพท์ (ส่วนใหญ่เป็นค่าอินเทอร์เน็ต ไม่ต้องติดป้ายทุกแถว)
export function kindTag(center: { kind: string }): string | undefined {
  return center.kind === "PHONE" ? "โทรศัพท์" : undefined;
}

// รหัสที่แสดงคู่กับชื่อในหน้ารายการ: ศูนย์ = รหัสลูกค้า, เบอร์ = หมายเลขแบบมีขีด
export function centerCode(center: { kind: string; customerCode: string }): string {
  return center.kind === "PHONE" ? formatPhone(center.customerCode) : center.customerCode;
}
