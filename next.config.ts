import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // ปุ่ม N ของ Next (เฉพาะตอนพัฒนา) ย้ายไปขวาล่าง ไม่ให้บังปุ่มออกจากระบบในแถบเมนูซ้าย
  devIndicators: { position: "bottom-right" },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // ทุกหน้าหลังล็อกอินอ่าน session/สิทธิ์จาก DB ทุกครั้ง (ตั้งใจไม่ cache เพื่อให้ปิดบัญชีมีผลทันที)
    // จึงไม่ต้องการให้ตรวจ "instant navigation" อัตโนมัติทุกหน้า — ตรวจเฉพาะ segment ที่ export `instant` เอง
    instantInsights: { validationLevel: "manual-warning" },
    // ไฟล์ใบแจ้งหนี้ ≤ 10MB (MAX_UPLOAD_BYTES) + เผื่อส่วนหัว multipart
    serverActions: { bodySizeLimit: "11mb" },
    proxyClientMaxBodySize: "11mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
