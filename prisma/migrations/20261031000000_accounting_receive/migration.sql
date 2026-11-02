-- ฝ่ายบัญชีรับเอกสาร (กระดาษ) ก่อนบันทึกจ่าย: อนุมัติแล้ว → บัญชีรับแล้ว → จ่ายแล้ว
-- ใบที่ "อนุมัติแล้ว" อยู่เดิม = ยังไม่ได้กดรับ (ไปอยู่แท็บรอรับเอกสาร)
ALTER TYPE "RequestStatus" ADD VALUE 'RECEIVED' AFTER 'APPROVED';
ALTER TYPE "LogAction" ADD VALUE 'RECEIVE' AFTER 'APPROVE';
ALTER TABLE "Request" ADD COLUMN "receivedAt" TIMESTAMP(3);
