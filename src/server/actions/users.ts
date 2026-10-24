"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/formState";
import { fieldErrorsOf, formValues, setPasswordSchema, userCreateSchema, userUpdateSchema } from "@/lib/validation";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/dbErrors";
import { hashPassword } from "@/server/password";
import { destroyUserSessions } from "@/server/session";

// ค่าที่ส่งกลับไปเติมฟอร์มเมื่อ error — ไม่ส่งรหัสผ่านกลับ
const withoutPasswords = (values: Record<string, string>) =>
  Object.fromEntries(Object.entries(values).filter(([key]) => key !== "password" && key !== "confirmPassword"));

// admin สร้างบัญชีและตั้งรหัสผ่านเริ่มต้นเอง — ผู้ใช้ต้องเปลี่ยนรหัสตอนล็อกอินครั้งแรก (admin จึงไม่รู้รหัสจริง)
export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN");

  const values = formValues(formData, ["username", "name", "title", "email", "role", "password", "confirmPassword"]);
  const parsed = userCreateSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values: withoutPasswords(values) };

  const { username, name, title, email, role, password } = parsed.data;
  try {
    await db.user.create({
      data: { username, name, title, email, role, passwordHash: await hashPassword(password), mustChangePassword: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { fieldErrors: { username: ["ชื่อผู้ใช้นี้มีอยู่แล้ว"] }, values: withoutPasswords(values) };
    throw error;
  }

  redirect(`/admin/users?created=${encodeURIComponent(username)}`);
}

export async function updateUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");

  const id = String(formData.get("id") ?? "");
  const values = formValues(formData, ["username", "name", "title", "email", "role", "active"]);
  const parsed = userUpdateSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  // กัน admin ล็อกตัวเองออกจากระบบ (และรับประกันว่ามี admin ที่ใช้งานได้อย่างน้อย 1 คนเสมอ)
  if (id === admin.id && (parsed.data.role !== "ADMIN" || !parsed.data.active)) {
    return { error: "เปลี่ยนบทบาทหรือปิดบัญชีของตัวเองไม่ได้", values };
  }

  // เปลี่ยนชื่อผู้ใช้ได้ (session ผูกกับ id จึงไม่หลุด) — ครั้งต่อไปต้องล็อกอินด้วยชื่อใหม่
  try {
    await db.user.update({ where: { id }, data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) return { fieldErrors: { username: ["ชื่อผู้ใช้นี้มีอยู่แล้ว"] }, values };
    throw error;
  }
  if (!parsed.data.active) await destroyUserSessions(id);

  redirect("/admin/users");
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");

  const id = String(formData.get("id") ?? "");
  if (id === admin.id) return { error: "รหัสผ่านของตัวเองให้เปลี่ยนที่เมนู \"เปลี่ยนรหัสผ่าน\"" };

  const parsed = setPasswordSchema.safeParse(formValues(formData, ["password", "confirmPassword"]));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  await db.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(parsed.data.password), mustChangePassword: true },
  });
  await destroyUserSessions(id);

  return { message: "ตั้งรหัสผ่านใหม่แล้ว ผู้ใช้ต้องเปลี่ยนรหัสเองตอนล็อกอินครั้งถัดไป" };
}
