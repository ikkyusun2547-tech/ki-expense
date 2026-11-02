// ตัวอักษรย่อสำหรับวงกลมรูปผู้ใช้ — ข้ามคำนำหน้าชื่อ (นางสาวสมศรี → ส)
const PREFIXES = ["นางสาว", "น.ส.", "นาง", "นาย", "ดร.", "คุณ"];

export function nameInitial(name: string): string {
  let rest = name.trim();
  const prefix = PREFIXES.find((p) => rest.startsWith(p) && rest.length > p.length);
  if (prefix) rest = rest.slice(prefix.length).trim();
  return Array.from(rest)[0] ?? "?";
}

// ชื่อ-นามสกุล ไม่มีคำนำหน้า (ปุ่มผู้ใช้มุมขวาบน): "นางสาวสมศรี ใจดี" → "สมศรี ใจดี"
export function nameWithoutPrefix(name: string): string {
  const rest = name.trim();
  const prefix = PREFIXES.find((p) => rest.startsWith(p) && rest.length > p.length);
  return prefix ? rest.slice(prefix.length).trim() : rest;
}

// ชื่อต้น (ไม่มีคำนำหน้า/นามสกุล) สำหรับทักทาย: "นางสาวสมศรี ใจดี" → "สมศรี"
export function firstName(name: string): string {
  return nameWithoutPrefix(name).split(/\s+/)[0] || name.trim();
}

// คำทักทายตามช่วงเวลา (ชั่วโมงเวลาไทย 0–23) — แสดงเหนือหัวข้อหน้าแรกของแต่ละบทบาท
export function greeting(name: string, hour: number): string {
  const time = hour >= 5 && hour < 12 ? "ตอนเช้า" : hour >= 12 && hour < 17 ? "ตอนบ่าย" : hour >= 17 && hour < 21 ? "ตอนเย็น" : "";
  return `สวัสดี${time} คุณ${firstName(name)} 👋`;
}
