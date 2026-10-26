"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/formState";
import type { ServiceKind } from "@/generated/prisma/enums";
import { centerSchema, fieldErrorsOf, formValues, phoneSchema } from "@/lib/validation";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/dbErrors";

const FIELDS = ["customerCode", "serviceNumber", "provider", "name", "normalAmount", "dueDay", "status"] as const;
const PHONE_FIELDS = ["phoneNumber", "provider", "accountCode", "name", "normalAmount", "dueDay", "status"] as const;

const REGISTRY_PATH: Record<ServiceKind, string> = { INTERNET: "/admin/centers", PHONE: "/admin/phones" };

// ศูนย์ (ค่าอินเทอร์เน็ต): สร้างใหม่เมื่อไม่มี id, แก้ไขเมื่อมี id
export async function saveCenter(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN");

  const id = String(formData.get("id") ?? "");
  const values = formValues(formData, FIELDS);
  const parsed = centerSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  try {
    if (id) await db.center.update({ where: { id, kind: "INTERNET" }, data: parsed.data });
    else await db.center.create({ data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { fieldErrors: { customerCode: ["รหัสลูกค้านี้มีในทะเบียนแล้ว"] }, values };
    }
    throw error;
  }

  redirect(REGISTRY_PATH.INTERNET);
}

// เบอร์โทรศัพท์ (ค่าโทรศัพท์): เก็บในตาราง Center kind = PHONE — หมายเลข → customerCode, รหัสลูกค้าของค่าย → serviceNumber
export async function savePhone(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN");

  const id = String(formData.get("id") ?? "");
  const values = formValues(formData, PHONE_FIELDS);
  const parsed = phoneSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const { phoneNumber, accountCode, ...rest } = parsed.data;
  const data = { ...rest, kind: "PHONE" as const, customerCode: phoneNumber, serviceNumber: accountCode };
  try {
    if (id) await db.center.update({ where: { id, kind: "PHONE" }, data });
    else await db.center.create({ data });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { fieldErrors: { phoneNumber: ["หมายเลขนี้มีในทะเบียนแล้ว"] }, values };
    }
    throw error;
  }

  redirect(REGISTRY_PATH.PHONE);
}

// ลบได้เฉพาะรายการที่ไม่เคยมีใบเบิก (รวมใบที่ลบไปแล้ว) — ที่เคยเบิกให้เปลี่ยนสถานะแทน (ใช้ทั้งศูนย์และเบอร์โทรศัพท์)
export async function deleteCenter(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN");

  const id = String(formData.get("id") ?? "");
  const center = await db.center.findUnique({ where: { id }, select: { kind: true } });
  if (!center) return { error: "ไม่พบรายการนี้ในทะเบียน" };

  const requestCount = await db.request.count({ where: { centerId: id } });
  if (requestCount > 0) {
    return center.kind === "PHONE"
      ? { error: `เบอร์นี้เคยมีใบเบิก ${requestCount} ใบ ลบไม่ได้ ให้เปลี่ยนสถานะเป็น "ยกเลิก" แทน` }
      : { error: `ศูนย์นี้เคยมีใบเบิก ${requestCount} ใบ ลบไม่ได้ ให้เปลี่ยนสถานะเป็น "ย้าย" หรือ "ปิด" แทน` };
  }

  await db.center.delete({ where: { id } });
  redirect(REGISTRY_PATH[center.kind]);
}
