"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/formState";
import { fieldErrorsOf, formValues, userCreateSchema, userUpdateSchema } from "@/lib/validation";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/dbErrors";
import { generateTempPassword, hashPassword } from "@/server/password";
import { destroyUserSessions } from "@/server/session";

// admin สร้างบัญชีพร้อมรหัสชั่วคราว (แสดงครั้งเดียว) ผู้ใช้ต้องเปลี่ยนรหัสตอนล็อกอินครั้งแรก
export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN");

  const values = formValues(formData, ["username", "name", "email", "role"]);
  const parsed = userCreateSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const tempPassword = generateTempPassword();
  try {
    await db.user.create({
      data: { ...parsed.data, passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { fieldErrors: { username: ["ชื่อผู้ใช้นี้มีอยู่แล้ว"] }, values };
    throw error;
  }

  return { tempPassword, message: `สร้างบัญชี ${parsed.data.username} แล้ว` };
}

export async function updateUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");

  const id = String(formData.get("id") ?? "");
  const values = formValues(formData, ["name", "email", "role", "active"]);
  const parsed = userUpdateSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  // กัน admin ล็อกตัวเองออกจากระบบ (และรับประกันว่ามี admin ที่ใช้งานได้อย่างน้อย 1 คนเสมอ)
  if (id === admin.id && (parsed.data.role !== "ADMIN" || !parsed.data.active)) {
    return { error: "เปลี่ยนบทบาทหรือปิดบัญชีของตัวเองไม่ได้", values };
  }

  await db.user.update({ where: { id }, data: parsed.data });
  if (!parsed.data.active) await destroyUserSessions(id);

  redirect("/admin/users");
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");

  const id = String(formData.get("id") ?? "");
  if (id === admin.id) return { error: "รหัสผ่านของตัวเองให้เปลี่ยนที่เมนู \"เปลี่ยนรหัสผ่าน\"" };

  const tempPassword = generateTempPassword();
  await db.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  });
  await destroyUserSessions(id);

  return { tempPassword, message: "รีเซ็ตรหัสผ่านแล้ว ผู้ใช้ต้องเปลี่ยนรหัสตอนล็อกอินครั้งถัดไป" };
}
