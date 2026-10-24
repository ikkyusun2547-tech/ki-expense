-- ข้อความหัวบันทึก (จาก/เรียน/เพื่อ) เป็นของแต่ละใบเบิก แทนหน้าตั้งค่ากลาง (ผู้ใช้เลือก 2026-10-25)
-- ใบเดิม: ใช้ค่าจากหน้าตั้งค่าที่เคยบันทึกไว้ ถ้าไม่มีใช้ค่าตามฟอร์มจริง (ตรงกับ DEFAULT_MEMO_TEXTS ใน memoData.ts)

ALTER TABLE "Request" ADD COLUMN "department" TEXT,
ADD COLUMN "recipient" TEXT,
ADD COLUMN "purpose" TEXT;

UPDATE "Request" SET "department" = s."department", "recipient" = s."recipient", "purpose" = s."purpose"
FROM "ReportSetting" s WHERE s."id" = 1;

UPDATE "Request" SET
  "department" = COALESCE("department", 'ฝ่ายจัดหาวัตถุดิบ'),
  "recipient" = COALESCE("recipient", 'ผู้จัดการฝ่ายบัญชี - ผู้จัดการฝ่ายการเงิน'),
  "purpose" = COALESCE("purpose", 'โปรดพิจารณา');

ALTER TABLE "Request" ALTER COLUMN "department" SET NOT NULL,
ALTER COLUMN "recipient" SET NOT NULL,
ALTER COLUMN "purpose" SET NOT NULL;

-- DropTable (รหัสฟอร์มย้ายเป็นค่าคงที่ FORM_CODE, ตำแหน่งสำรองเลิกใช้ — บัญชีผู้จัดทำบังคับมีตำแหน่ง)
DROP TABLE "ReportSetting";
