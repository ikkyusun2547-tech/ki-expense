"use server";

import { decodeCsvBuffer, parseCentersCsv, type CenterRow } from "@/lib/centers/parseCentersCsv";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";

// admin นำเข้าทะเบียนศูนย์จากไฟล์ CSV (Excel → บันทึกเป็น CSV) — upsert ตามรหัสลูกค้า เหมือน npm run db:seed
// mode=preview: ตรวจไฟล์อย่างเดียว (ไม่บันทึก) / mode=import: บันทึกจริง (ตรวจซ้ำก่อนเสมอ)
// ไฟล์มีปัญหาแม้บรรทัดเดียว → ไม่นำเข้าอะไรเลย แจ้งทุกบรรทัดให้แก้ในรอบเดียว

export type ImportPreviewRow = CenterRow & { action: "new" | "update" | "same" };

export type CenterImportState = {
  error?: string;
  errors?: string[]; // ปัญหาในไฟล์ ทีละบรรทัด
  encodingNote?: string;
  preview?: { rows: ImportPreviewRow[]; newCount: number; updateCount: number; sameCount: number };
  imported?: number;
};

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const same = (row: CenterRow, c: { serviceNumber: string | null; name: string; normalAmount: { toFixed(n: number): string }; dueDay: number; status: string }) =>
  c.serviceNumber === row.serviceNumber &&
  c.name === row.name &&
  c.normalAmount.toFixed(2) === row.normalAmount &&
  c.dueDay === row.dueDay &&
  c.status === row.status;

export async function importCenters(_prev: CenterImportState, formData: FormData): Promise<CenterImportState> {
  await requireRole("ADMIN");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "เลือกไฟล์ CSV ก่อน" };
  if (file.size > MAX_FILE_BYTES) return { error: "ไฟล์ใหญ่เกิน 2MB" };

  const { text, encoding } = decodeCsvBuffer(new Uint8Array(await file.arrayBuffer()));
  const encodingNote = encoding === "utf-8" ? undefined : "อ่านไฟล์เป็นภาษาไทยแบบ Windows (TIS-620) แล้ว — ถ้าชื่อศูนย์เพี้ยน ให้บันทึกจาก Excel เป็น \"CSV UTF-8\"";
  const { rows, errors } = parseCentersCsv(text);
  if (errors.length) return { errors, encodingNote };
  if (rows.length === 0) return { error: "ไม่พบข้อมูลศูนย์ในไฟล์", encodingNote };

  if (formData.get("mode") !== "import") {
    const existing = await db.center.findMany({ where: { customerCode: { in: rows.map((r) => r.customerCode) } } });
    const byCode = new Map(existing.map((c) => [c.customerCode, c]));
    const preview: ImportPreviewRow[] = rows.map((row) => {
      const current = byCode.get(row.customerCode);
      return { ...row, action: !current ? "new" : same(row, current) ? "same" : "update" };
    });
    const count = (a: ImportPreviewRow["action"]) => preview.filter((r) => r.action === a).length;
    return { encodingNote, preview: { rows: preview, newCount: count("new"), updateCount: count("update"), sameCount: count("same") } };
  }

  await db.$transaction(
    rows.map((row) => db.center.upsert({ where: { customerCode: row.customerCode }, create: row, update: row })),
  );
  return { imported: rows.length };
}
