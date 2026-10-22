"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/formState";
import { centerSchema, fieldErrorsOf, formValues } from "@/lib/validation";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/dbErrors";

const FIELDS = ["customerCode", "serviceNumber", "name", "normalAmount", "dueDay", "status"] as const;

// สร้างใหม่เมื่อไม่มี id, แก้ไขเมื่อมี id
export async function saveCenter(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN");

  const id = String(formData.get("id") ?? "");
  const values = formValues(formData, FIELDS);
  const parsed = centerSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  try {
    if (id) await db.center.update({ where: { id }, data: parsed.data });
    else await db.center.create({ data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { fieldErrors: { customerCode: ["รหัสลูกค้านี้มีในทะเบียนแล้ว"] }, values };
    }
    throw error;
  }

  redirect("/admin/centers");
}

// ลบได้เฉพาะศูนย์ที่ไม่เคยมีใบเบิก (รวมใบที่ลบไปแล้ว) — ศูนย์ที่เคยเบิกให้เปลี่ยนสถานะแทน
export async function deleteCenter(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN");

  const id = String(formData.get("id") ?? "");
  const requestCount = await db.request.count({ where: { centerId: id } });
  if (requestCount > 0) {
    return { error: `ศูนย์นี้เคยมีใบเบิก ${requestCount} ใบ ลบไม่ได้ ให้เปลี่ยนสถานะเป็น "ย้าย" หรือ "ปิด" แทน` };
  }

  await db.center.delete({ where: { id } });
  redirect("/admin/centers");
}
