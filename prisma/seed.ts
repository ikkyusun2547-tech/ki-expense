// seed ทะเบียนศูนย์จาก data/centers.csv + admin คนแรกจาก env (SEED_ADMIN_*)
// รันซ้ำได้: upsert ตามรหัสลูกค้า / ชื่อผู้ใช้
// ถ้า CSV มี error แม้แต่บรรทัดเดียว จะไม่นำเข้าอะไรเลย
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { decodeCsvBuffer, parseCentersCsv } from "../src/lib/centers/parseCentersCsv";
import { db } from "../src/server/db";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/server/password";

const CSV_PATH = path.join(process.cwd(), "data", "centers.csv");

async function seedCenters() {
  if (!existsSync(CSV_PATH)) {
    console.error(`✗ ไม่พบไฟล์ ${CSV_PATH} — วางไฟล์ทะเบียนศูนย์ (CSV UTF-8) ไว้ที่นี่ก่อน`);
    process.exit(1);
  }

  const { text, encoding } = decodeCsvBuffer(readFileSync(CSV_PATH));
  if (encoding !== "utf-8") console.warn(`⚠ อ่านไฟล์เป็น ${encoding} (แนะนำให้บันทึกเป็น CSV UTF-8)`);

  const { rows, errors } = parseCentersCsv(text);
  if (errors.length) {
    console.error(`✗ พบปัญหาใน ${CSV_PATH} — ยังไม่ได้นำเข้า:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  await db.$transaction(
    rows.map((row) =>
      db.center.upsert({
        where: { customerCode: row.customerCode },
        create: row,
        update: row,
      }),
    ),
  );
  console.log(`✓ ทะเบียนศูนย์ ${rows.length} รายการ`);
}

// สร้าง admin ถ้ายังไม่มี; ถ้ามีแล้วไม่แตะรหัสผ่าน (กันรีเซ็ตรหัสที่ admin เปลี่ยนไปแล้ว)
async function seedAdmin() {
  const username = process.env.SEED_ADMIN_USERNAME?.trim().toLowerCase();
  const name = process.env.SEED_ADMIN_NAME?.trim() || username;
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!username || !name) {
    console.warn("⚠ ไม่ได้ตั้ง SEED_ADMIN_USERNAME — ข้ามการสร้าง admin");
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`✗ SEED_ADMIN_PASSWORD ต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
    process.exit(1);
  }

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    await db.user.update({ where: { username }, data: { role: "ADMIN", active: true } });
    console.log(`✓ admin: ${username} (มีอยู่แล้ว ไม่เปลี่ยนรหัสผ่าน)`);
    return;
  }

  await db.user.create({
    data: { username, name, role: "ADMIN", passwordHash: await hashPassword(password), mustChangePassword: true },
  });
  console.log(`✓ admin: ${username} (สร้างใหม่ — ต้องเปลี่ยนรหัสผ่านตอนล็อกอินครั้งแรก)`);
}

async function main() {
  await seedAdmin();
  await seedCenters();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
