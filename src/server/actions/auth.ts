"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HOME_PATH } from "@/lib/auth/routes";
import { checkLockout, LOCKOUT_MINUTES, MAX_FAILURES, minutesUntil } from "@/lib/auth/loginThrottle";
import type { FormState } from "@/lib/formState";
import { changePasswordSchema, fieldErrorsOf } from "@/lib/validation";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/password";
import { createSession, destroySession, destroyUserSessions, readSession } from "@/server/session";

// hash หลอก ใช้ตรวจเมื่อไม่พบชื่อผู้ใช้ เพื่อให้เวลาตอบสนองใกล้เคียงกรณีพบ (กันเดาชื่อผู้ใช้จากเวลา)
let dummyHash: Promise<string> | undefined;

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const values = { username };

  if (!username || !password) return { error: "กรอกชื่อผู้ใช้และรหัสผ่าน", values };

  const now = new Date();
  const recent = await db.loginAttempt.findMany({
    where: { username, createdAt: { gte: new Date(now.getTime() - LOCKOUT_MINUTES * 60000) } },
    orderBy: { createdAt: "desc" },
    take: MAX_FAILURES,
  });
  const lockout = checkLockout(recent, now);
  if (lockout.locked) {
    return {
      error: `ใส่รหัสผ่านผิดหลายครั้ง กรุณารอประมาณ ${minutesUntil(lockout.unlockAt, now)} นาทีแล้วลองใหม่`,
      values,
    };
  }

  const user = await db.user.findUnique({ where: { username } });
  let success = false;
  if (user?.active) {
    success = await verifyPassword(password, user.passwordHash);
  } else {
    dummyHash ??= hashPassword("dummy-password");
    await verifyPassword(password, await dummyHash);
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  await db.loginAttempt.create({ data: { username, success, ip } });

  if (!success || !user) return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", values };

  await createSession(user.id, { remember: formData.get("remember") === "on" });
  redirect(user.mustChangePassword ? "/change-password" : HOME_PATH[user.role]);
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const current = await requireUser({ allowMustChangePassword: true });

  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const user = await db.user.findUniqueOrThrow({ where: { id: current.id } });
  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { fieldErrors: { currentPassword: ["รหัสผ่านปัจจุบันไม่ถูกต้อง"] } };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword), mustChangePassword: false },
  });

  // ออกจากทุกเครื่อง แล้วเปิด session ใหม่ให้เครื่องนี้ (คงแบบ "จดจำฉัน" ถ้า session เดิมเป็นแบบนั้น)
  const remember = ((await readSession())?.expiresAt.getTime() ?? 0) > Date.now() + 24 * 60 * 60 * 1000;
  await destroyUserSessions(user.id);
  await createSession(user.id, { remember });
  redirect(HOME_PATH[user.role]);
}
