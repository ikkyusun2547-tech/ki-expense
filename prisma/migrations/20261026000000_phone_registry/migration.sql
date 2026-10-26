-- ทะเบียนเบอร์โทรศัพท์ เก็บในตาราง Center เดียวกับศูนย์ (แยกด้วย kind) เพื่อให้ใบเบิกใช้กฎกันซ้ำ/ขั้นตอนเดิมได้
CREATE TYPE "ServiceKind" AS ENUM ('INTERNET', 'PHONE');

ALTER TABLE "Center" ADD COLUMN "kind" "ServiceKind" NOT NULL DEFAULT 'INTERNET',
ADD COLUMN "provider" TEXT NOT NULL DEFAULT '';

-- เบอร์โทรศัพท์มีแค่ ใช้งาน / ยกเลิก (CLOSED) — ไม่มี "ย้าย"
ALTER TABLE "Center" ADD CONSTRAINT "Center_phone_status" CHECK ("kind" <> 'PHONE' OR "status" <> 'MOVED');
