import "dotenv/config";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// integration test ใช้ DB แยก: <ชื่อ DB เดิม>_test (ล้างและ migrate ใหม่ทุกครั้งที่รัน — ดู tests/db/globalSetup.ts)
// ไฟล์อัปโหลดลงโฟลเดอร์ชั่วคราว ไม่ปนกับ UPLOAD_DIR จริง
const devUrl = new URL(process.env.DATABASE_URL ?? "");
const testUrl = new URL(devUrl);
testUrl.pathname = `${devUrl.pathname}_test`;
process.env.TEST_DATABASE_URL = testUrl.toString();

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/db/**/*.db.test.ts"],
    globalSetup: ["tests/db/globalSetup.ts"],
    setupFiles: ["tests/db/setup.ts"],
    env: {
      TZ: "Asia/Bangkok",
      DATABASE_URL: testUrl.toString(),
      UPLOAD_DIR: mkdtempSync(path.join(tmpdir(), "ie-test-uploads-")),
    },
    fileParallelism: false,
  },
});
