import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkInvoiceFile, safeDisplayName, type InvoiceFileType } from "@/lib/files";

// เก็บไฟล์ใบแจ้งหนี้บนดิสก์เครื่องนี้ (UPLOAD_DIR) — DB เก็บแค่ key (path ภายใน UPLOAD_DIR)
// ไฟล์เดิมไม่ถูกลบเมื่อแก้ไข/เปลี่ยนไฟล์ เพื่อเก็บหลักฐานย้อนหลัง

function uploadRoot(): string {
  const dir = process.env.UPLOAD_DIR;
  if (!dir) throw new Error("ยังไม่ได้ตั้งค่า UPLOAD_DIR ใน .env");
  return path.resolve(dir);
}

// key มาจาก DB แต่ยังกัน path traversal ไว้อีกชั้น
export function invoiceFilePath(key: string): string {
  const root = uploadRoot();
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error(`invalid file key: ${key}`);
  return full;
}

export type SavedFile = { key: string; fileName: string; type: InvoiceFileType };

export type SaveResult = { ok: true; file: SavedFile } | { ok: false; error: string };

export async function saveInvoiceFile(file: File, now: Date = new Date()): Promise<SaveResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkInvoiceFile(bytes);
  if (!check.ok) return check;

  const month = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const key = `${month}/${randomUUID()}.${check.type}`;
  const full = invoiceFilePath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes, { flag: "wx" });

  return { ok: true, file: { key, fileName: safeDisplayName(file.name), type: check.type } };
}

export async function readInvoiceFile(key: string): Promise<Buffer> {
  return readFile(invoiceFilePath(key));
}

// ใช้ย้อนกลับเมื่อบันทึก DB ไม่สำเร็จหลังเขียนไฟล์ไปแล้ว
export async function removeInvoiceFile(key: string): Promise<void> {
  await rm(invoiceFilePath(key), { force: true });
}
