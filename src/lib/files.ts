// ตรวจไฟล์ใบแจ้งหนี้จากเนื้อไฟล์จริง (magic bytes) ไม่เชื่อนามสกุลหรือ Content-Type จากเบราว์เซอร์

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "10MB";
export const ACCEPT_ATTR = "application/pdf,image/jpeg,image/png";

export type InvoiceFileType = "pdf" | "jpg" | "png";

export const CONTENT_TYPE: Record<InvoiceFileType, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
};

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b);

export function detectFileType(bytes: Uint8Array): InvoiceFileType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  return null;
}

export type FileCheck = { ok: true; type: InvoiceFileType } | { ok: false; error: string };

export function checkInvoiceFile(bytes: Uint8Array): FileCheck {
  if (bytes.length === 0) return { ok: false, error: "ไฟล์ว่างเปล่า" };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: `ไฟล์ใหญ่เกิน ${MAX_UPLOAD_LABEL}` };
  const type = detectFileType(bytes);
  if (!type) return { ok: false, error: "รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG" };
  return { ok: true, type };
}

// ชื่อไฟล์เดิมใช้แสดงผล/ตั้งชื่อตอนดาวน์โหลดเท่านั้น — ตัดอักขระที่ใช้ทำ path หรือ header ได้
export function safeDisplayName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\r\n\t]/g, "_").trim();
  return (cleaned || "invoice").slice(0, 150);
}
