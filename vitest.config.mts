import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/db/**"], // ใช้ DB จริง รันแยกด้วย npm run test:db
    // วันที่ทั้งระบบอิงเวลาไทย
    env: { TZ: "Asia/Bangkok" },
  },
});
