import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { readSession } from "./session";

// Data Access Layer ของการล็อกอิน
// - อ่านจาก DB ทุก request (ไม่ cache ข้าม request) เพื่อให้ปิดบัญชี/เปลี่ยนบทบาทมีผลทันที
// - ทุกหน้าและทุก Server Action ต้องเรียก requireUser/requireRole ก่อนทำงาน

export type CurrentUser = {
  id: string;
  username: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
};

// cache() ของ React = จำค่าเฉพาะภายใน request เดียว
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const { id, username, name, role, mustChangePassword } = session.user;
  return { id, username, name, role, mustChangePassword };
});

export async function requireUser(options?: { allowMustChangePassword?: boolean }): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !options?.allowMustChangePassword) redirect("/change-password");
  return user;
}

// บทบาทไม่ตรง → ส่งกลับหน้าแรก (ซึ่งจะพาไปหน้าของบทบาทตัวเอง)
// ใช้ได้ทั้งในหน้าและใน Server Action: action ที่ไม่มีสิทธิ์จะไม่ทำงานต่อจากบรรทัดนี้
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}
