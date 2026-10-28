-- ใบเบิกย้อนหลังที่นำเข้าจากตารางเดิม (จ่ายนอกระบบก่อนเริ่มใช้) — ไม่นับในรายการ/รายงานการจ่ายของฝ่ายบัญชี
ALTER TABLE "Request" ADD COLUMN "imported" BOOLEAN NOT NULL DEFAULT false;
