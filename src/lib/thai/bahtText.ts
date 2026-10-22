import { toAmountString, type AmountInput } from "@/lib/money";

// แปลงยอดเงินเป็นตัวหนังสือภาษาไทย เช่น 631.30 → "หกร้อยสามสิบเอ็ดบาทสามสิบสตางค์"

const DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

// อ่านเลขไม่เกิน 6 หลัก; useEt = หลักหน่วยเป็น 1 ให้อ่านว่า "เอ็ด"
function readUnderMillion(digits: string, useEt: boolean): string {
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[i]);
    const place = digits.length - 1 - i;
    if (d === 0) continue;
    if (place === 1 && d === 1) out += "สิบ";
    else if (place === 1 && d === 2) out += "ยี่สิบ";
    else if (place === 0 && d === 1 && useEt) out += "เอ็ด";
    else out += DIGITS[d] + PLACES[place];
  }
  return out;
}

// อ่านจำนวนเต็ม (ข้อความตัวเลข) คืน "" ถ้าเป็นศูนย์
// หน่วยเป็น 1 อ่าน "เอ็ด" เมื่อทั้งจำนวนมากกว่า 1 เช่น 11 สิบเอ็ด, 101 หนึ่งร้อยเอ็ด
function readInteger(raw: string): string {
  const digits = raw.replace(/^0+/, "");
  if (digits === "") return "";
  if (digits.length > 6) {
    return readInteger(digits.slice(0, -6)) + "ล้าน" + readUnderMillion(digits.slice(-6), true);
  }
  return readUnderMillion(digits, digits !== "1");
}

export function bahtText(amount: AmountInput): string {
  const [intPart, satangPart] = toAmountString(amount).split(".");
  const baht = readInteger(intPart);
  const satang = readInteger(satangPart);

  if (!baht && !satang) return "ศูนย์บาทถ้วน";
  return (baht ? `${baht}บาท` : "") + (satang ? `${satang}สตางค์` : "ถ้วน");
}
