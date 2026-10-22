import type { Role } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { hashPassword } from "@/server/password";
import { cookieJar } from "./setup";

// ข้อมูลทดสอบทุกชิ้นขึ้นต้นด้วย PREFIX เพื่อลบทิ้งได้ครบหลังจบ
export const PREFIX = "zz-test-";
export const PASSWORD = "test-password-1";

export async function createTestUser(name: string, role: Role, options: { mustChangePassword?: boolean } = {}) {
  return db.user.create({
    data: {
      username: `${PREFIX}${name}`,
      name: `ทดสอบ ${name}`,
      role,
      passwordHash: await hashPassword(PASSWORD),
      mustChangePassword: options.mustChangePassword ?? false,
    },
  });
}

export async function cleanup() {
  cookieJar.clear();
  await db.request.deleteMany({ where: { center: { customerCode: { startsWith: PREFIX } } } });
  await db.center.deleteMany({ where: { customerCode: { startsWith: PREFIX } } });
  await db.loginAttempt.deleteMany({ where: { username: { startsWith: PREFIX } } });
  await db.user.deleteMany({ where: { username: { startsWith: PREFIX } } }); // session ลบตามแบบ cascade
}

export function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

// รัน action แล้วคืนปลายทาง redirect (ถ้ามี) หรือผลลัพธ์ปกติ
export async function run<T>(fn: () => Promise<T>): Promise<{ redirect: string } | { result: T }> {
  try {
    return { result: await fn() };
  } catch (error) {
    const digest = (error as { digest?: string }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      return { redirect: digest.split(";")[2] };
    }
    throw error;
  }
}
