"use server";

import { readSheet } from "read-excel-file/node";
import type { ServiceKind } from "@/generated/prisma/enums";
import { decodeCsvBuffer, parseCentersCsv, type CenterRow } from "@/lib/centers/parseCentersCsv";
import { DEFAULT_PROVIDER, formatPhone } from "@/lib/centers/phone";
import { parsePhonesCsv } from "@/lib/centers/phoneCsv";
import {
  IMPORTED_INVOICE_NO,
  IMPORTED_PAYMENT_REF,
  parseYearlyTable,
  planBills,
  type TableBill,
} from "@/lib/centers/yearlyTable";
import { DEFAULT_MEMO_TEXTS_BY_KIND, INTERNET_PROVIDER } from "@/lib/pdf/memoData";
import { fromISODate, toISODate } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";

// admin นำเข้าทะเบียนศูนย์ / ทะเบียนเบอร์โทรศัพท์ — upsert ตามรหัสค้นหา (customerCode)
// kind=PHONE: ทะเบียนเบอร์โทรศัพท์ / อื่น ๆ: ทะเบียนศูนย์ (เหมือน npm run db:seed)
// ไฟล์ 2 แบบ:
// - .xlsx = ตารางรายปีแบบกระดาษเดิม (lib/centers/yearlyTable.ts) → ทะเบียน + บิลย้อนหลังเป็นใบเบิก "จ่ายแล้ว" (imported)
//   ศูนย์ที่มีอยู่แล้ว: อัปเดตเฉพาะชื่อ/หมายเลขบริการ/สถานะที่เขียนไว้ — ค่าย ยอดปกติ วันครบกำหนด คงเดิม
//   บิลที่รอบทับใบเดิม (หรือนำเข้าไปแล้ว) ข้ามไป → นำเข้าไฟล์เดิมซ้ำได้
// - .csv = ทะเบียนอย่างเดียว (หัวคอลัมน์ตาม parseCentersCsv / phoneCsv)
// mode=preview: ตรวจไฟล์อย่างเดียว (ไม่บันทึก) / mode=import: บันทึกจริง (ตรวจซ้ำก่อนเสมอ)
// ไฟล์มีปัญหาแม้บรรทัดเดียว → ไม่นำเข้าอะไรเลย แจ้งทุกบรรทัดให้แก้ในรอบเดียว

type ImportRow = CenterRow;

export type ImportPreviewRow = ImportRow & { action: "new" | "update" | "same"; bills?: number };

export type CenterImportState = {
  error?: string;
  errors?: string[]; // ปัญหาในไฟล์ ทีละบรรทัด
  encodingNote?: string;
  preview?: {
    rows: ImportPreviewRow[];
    newCount: number;
    updateCount: number;
    sameCount: number;
    bills?: { newCount: number; skipCount: number }; // เฉพาะตารางรายปี (.xlsx)
  };
  imported?: number;
  importedBills?: number;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Existing = {
  serviceNumber: string | null;
  provider: string;
  name: string;
  normalAmount: { toFixed(n: number): string };
  dueDay: number;
  status: string;
};

const same = (row: ImportRow, c: Existing) =>
  c.serviceNumber === row.serviceNumber &&
  c.provider === row.provider &&
  c.name === row.name &&
  c.normalAmount.toFixed(2) === row.normalAmount &&
  c.dueDay === row.dueDay &&
  c.status === row.status;

type Parsed = { rows: ImportRow[]; bills: TableBill[]; errors: string[]; encodingNote?: string; error?: string };

async function readCsv(file: File, kind: ServiceKind): Promise<Parsed> {
  const { text, encoding } = decodeCsvBuffer(new Uint8Array(await file.arrayBuffer()));
  const encodingNote =
    encoding === "utf-8"
      ? undefined
      : 'อ่านไฟล์เป็นภาษาไทยแบบ Windows (TIS-620) แล้ว — ถ้าภาษาไทยเพี้ยน ให้บันทึกจาก Excel เป็น "CSV UTF-8"';
  const { rows, errors } = kind === "PHONE" ? parsePhonesCsv(text) : parseCentersCsv(text);
  return { rows, bills: [], errors, encodingNote };
}

async function readYearlyTable(file: File, kind: ServiceKind): Promise<Parsed> {
  let data: unknown[][];
  try {
    // ตัวเลขอ่านเป็นข้อความตามที่เขียนในไฟล์ (เงินต้องไม่ผ่านทศนิยมแบบ float)
    data = await readSheet(Buffer.from(await file.arrayBuffer()), { parseNumber: (s: string) => s });
  } catch {
    return { rows: [], bills: [], errors: [], error: "อ่านไฟล์ Excel ไม่ได้ — ต้องเป็นไฟล์ .xlsx (ถ้าเป็น .xls ให้เปิดใน Excel แล้วบันทึกเป็น .xlsx)" };
  }
  const table = parseYearlyTable(data, kind);
  if (table.errors.length) return { rows: [], bills: [], errors: table.errors };

  const existing = await db.center.findMany({ where: { customerCode: { in: table.centers.map((c) => c.customerCode) } } });
  const byCode = new Map(existing.map((c) => [c.customerCode, c]));
  const errors: string[] = [];
  const rows: ImportRow[] = [];
  for (const c of table.centers) {
    const current = byCode.get(c.customerCode);
    if (current) {
      rows.push({
        customerCode: c.customerCode,
        serviceNumber: c.serviceNumber ?? current.serviceNumber,
        provider: current.provider,
        name: c.name,
        normalAmount: current.normalAmount.toFixed(2),
        dueDay: current.dueDay,
        status: c.status ?? current.status,
      });
    } else if (!c.normalAmount || !c.dueDay) {
      errors.push(`บรรทัด ${c.line} (${c.name}): ${kind === "PHONE" ? "เบอร์" : "ศูนย์"}ใหม่ต้องกรอกอย่างน้อย 1 เดือน (ใช้เป็นยอดปกติและวันครบกำหนด)`);
    } else {
      rows.push({
        customerCode: c.customerCode,
        serviceNumber: c.serviceNumber,
        provider: kind === "PHONE" ? DEFAULT_PROVIDER : INTERNET_PROVIDER,
        name: c.name,
        normalAmount: c.normalAmount,
        dueDay: c.dueDay,
        status: c.status ?? "ACTIVE",
      });
    }
  }
  return { rows, bills: table.bills, errors };
}

// รอบบริการของใบเดิม (ไม่นับใบที่ลบ) แยกตามรหัส — ใช้คัดบิลย้อนหลังที่ซ้ำ
async function existingPeriods(client: Pick<typeof db, "request">, codes: string[]) {
  const requests = await client.request.findMany({
    where: { deletedAt: null, center: { customerCode: { in: codes } } },
    select: { periodStart: true, periodEnd: true, center: { select: { customerCode: true } } },
  });
  const map = new Map<string, { start: string; end: string }[]>();
  for (const r of requests) {
    const list = map.get(r.center.customerCode) ?? [];
    list.push({ start: toISODate(r.periodStart), end: toISODate(r.periodEnd) });
    map.set(r.center.customerCode, list);
  }
  return map;
}

export async function importCenters(_prev: CenterImportState, formData: FormData): Promise<CenterImportState> {
  const actor = await requireRole("ADMIN");

  const phone = formData.get("kind") === "PHONE";
  const kind: ServiceKind = phone ? "PHONE" : "INTERNET";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "เลือกไฟล์ก่อน" };
  if (file.size > MAX_FILE_BYTES) return { error: "ไฟล์ใหญ่เกิน 5MB" };

  const { rows, bills, errors, encodingNote, error } = /\.xlsx$/i.test(file.name) ? await readYearlyTable(file, kind) : await readCsv(file, kind);
  if (error) return { error };
  if (errors.length) return { errors, encodingNote };
  if (rows.length === 0) return { error: phone ? "ไม่พบข้อมูลเบอร์โทรศัพท์ในไฟล์" : "ไม่พบข้อมูลศูนย์ในไฟล์", encodingNote };

  const codes = rows.map((r) => r.customerCode);
  const existing = await db.center.findMany({ where: { customerCode: { in: codes } } });
  const byCode = new Map(existing.map((c) => [c.customerCode, c]));

  // รหัสเดียวกันอยู่ในทะเบียนอีกประเภท → ไม่เขียนทับข้ามประเภท
  const conflicts = rows
    .filter((r) => byCode.get(r.customerCode) && byCode.get(r.customerCode)!.kind !== kind)
    .map((r) =>
      phone
        ? `เบอร์ ${formatPhone(r.customerCode)} ซ้ำกับรหัสลูกค้าในทะเบียนศูนย์`
        : `รหัสลูกค้า ${r.customerCode} ซ้ำกับเบอร์ในทะเบียนเบอร์โทรศัพท์`,
    );
  if (conflicts.length) return { errors: conflicts, encodingNote };

  if (formData.get("mode") !== "import") {
    const plan = planBills(bills, await existingPeriods(db, codes));
    const preview: ImportPreviewRow[] = rows.map((row) => {
      const current = byCode.get(row.customerCode);
      return {
        ...row,
        action: !current ? "new" : same(row, current) ? "same" : "update",
        ...(bills.length ? { bills: plan.create.filter((b) => b.customerCode === row.customerCode).length } : {}),
      };
    });
    const count = (a: ImportPreviewRow["action"]) => preview.filter((r) => r.action === a).length;
    return {
      encodingNote,
      preview: {
        rows: preview,
        newCount: count("new"),
        updateCount: count("update"),
        sameCount: count("same"),
        ...(bills.length ? { bills: { newCount: plan.create.length, skipCount: plan.skipped.length } } : {}),
      },
    };
  }

  const memo = DEFAULT_MEMO_TEXTS_BY_KIND[kind];
  const importedBills = await db.$transaction(
    async (tx) => {
      for (const row of rows) await tx.center.upsert({ where: { customerCode: row.customerCode }, create: row, update: row });
      if (bills.length === 0) return 0;

      // คัดซ้ำอีกครั้งใน transaction (กันกดนำเข้าพร้อมกัน — Request_no_overlap กันชั้นสุดท้าย)
      const { create } = planBills(bills, await existingPeriods(tx, codes));
      const centerIds = new Map(
        (await tx.center.findMany({ where: { customerCode: { in: codes } }, select: { id: true, customerCode: true } })).map((c) => [c.customerCode, c.id]),
      );
      const created = await tx.request.createManyAndReturn({
        data: create.map((b) => ({
          centerId: centerIds.get(b.customerCode)!,
          invoiceNo: IMPORTED_INVOICE_NO,
          amount: b.amount,
          periodStart: fromISODate(b.periodStart),
          periodEnd: fromISODate(b.periodEnd),
          dueDate: fromISODate(b.dueDate),
          status: "PAID" as const,
          paidDate: fromISODate(b.dueDate), // ตารางเดิมไม่มีวันที่จ่าย — ใช้กำหนดชำระ (ผู้ใช้เลือก)
          paymentRef: IMPORTED_PAYMENT_REF,
          imported: true,
          ...memo,
          createdById: actor.id,
        })),
        select: { id: true },
      });
      await tx.approvalLog.createMany({
        data: created.map((r) => ({
          requestId: r.id,
          action: "CREATE" as const,
          toStatus: "PAID" as const,
          actorId: actor.id,
          note: "นำเข้าย้อนหลังจากตารางเดิม (จ่ายแล้ว)",
        })),
      });
      return created.length;
    },
    { timeout: 60_000 },
  );
  return bills.length ? { imported: rows.length, importedBills } : { imported: rows.length };
}
