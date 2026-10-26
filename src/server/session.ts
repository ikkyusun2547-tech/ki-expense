import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/routes";
import { db } from "./db";

// session เก็บใน DB: cookie ถือ token สุ่ม, DB เก็บแค่ sha256 ของ token
// ถ้า DB รั่ว ก็เอา hash ไปปลอม cookie ไม่ได้; ลบแถวใน DB = บังคับออกจากระบบทันที

const SESSION_HOURS = 12;
// "จดจำฉัน" ตอนล็อกอิน (ผู้ใช้ขอ 2026-10-26: ไม่ต้องพิมพ์รหัสทุกวัน) — เครื่องส่วนตัวเท่านั้น
export const REMEMBER_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// cookie secure = ส่งเฉพาะ HTTPS; ระบบจริงใช้ http ในวงแลน จึงตั้ง COOKIE_SECURE=false ใน .env ของระบบจริง
function cookieSecure(): boolean {
  const flag = process.env.COOKIE_SECURE;
  if (flag) return flag === "true";
  return process.env.NODE_ENV === "production";
}

export async function createSession(userId: string, options: { remember?: boolean } = {}): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const hours = options.remember ? REMEMBER_DAYS * 24 : SESSION_HOURS;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  await db.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    expires: expiresAt,
  });
}

// คืน session + user ถ้ายังใช้ได้ (ไม่หมดอายุ และบัญชียัง active)
export async function readSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  await connection(); // ใช้เวลาปัจจุบันด้านล่าง ต้องคำนวณตอน request เท่านั้น
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return session;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

// ใช้ตอนปิดบัญชี / รีเซ็ตรหัส / เปลี่ยนรหัส — ทุกเครื่องที่ล็อกอินอยู่ต้องออก
export async function destroyUserSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
