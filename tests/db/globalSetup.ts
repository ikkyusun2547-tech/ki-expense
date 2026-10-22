import { execSync } from "node:child_process";
import { Client } from "pg";

// สร้าง DB ทดสอบถ้ายังไม่มี แล้วล้าง schema + migrate ใหม่ทุกครั้ง
// (ApprovalLog ลบไม่ได้ จึงล้างทั้ง schema แทนการลบรายแถว)
export default async function setup() {
  const testUrl = process.env.TEST_DATABASE_URL;
  const devUrl = process.env.DATABASE_URL;
  if (!testUrl || testUrl === devUrl || !new URL(testUrl).pathname.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL ไม่ถูกต้อง — ปฏิเสธการล้างฐานข้อมูล");
  }
  const dbName = new URL(testUrl).pathname.slice(1);

  const admin = new Client({ connectionString: devUrl });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const test = new Client({ connectionString: testUrl });
  await test.connect();
  await test.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await test.end();

  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: testUrl }, stdio: "pipe" });
}
