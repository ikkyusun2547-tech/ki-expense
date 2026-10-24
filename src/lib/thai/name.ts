// ตัวอักษรย่อสำหรับวงกลมรูปผู้ใช้ — ข้ามคำนำหน้าชื่อ (นางสาวสมศรี → ส)
const PREFIXES = ["นางสาว", "น.ส.", "นาง", "นาย", "ดร.", "คุณ"];

export function nameInitial(name: string): string {
  let rest = name.trim();
  const prefix = PREFIXES.find((p) => rest.startsWith(p) && rest.length > p.length);
  if (prefix) rest = rest.slice(prefix.length).trim();
  return Array.from(rest)[0] ?? "?";
}
