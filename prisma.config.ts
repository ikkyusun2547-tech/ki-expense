import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // ไม่ใช้ env() เพราะจะ throw ตอน `prisma generate` ถ้ายังไม่ได้ตั้ง DATABASE_URL
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
