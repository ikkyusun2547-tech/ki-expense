-- อนุมัติในระบบ: บทบาทผู้อนุมัติ, สถานะรออนุมัติ, ผู้ลงนาม = บัญชีผู้ใช้ (เลิกใช้ตาราง Signer)
-- เขียนเอง: enum สถานะใช้ RENAME/ADD VALUE แทนการสร้าง type ใหม่ของ Prisma
-- (ใบเดิมที่ "ส่งบัญชีแล้ว" = อยู่ในคิวบัญชี จึงกลายเป็น APPROVED; log เดิมก็เปลี่ยนชื่อค่าตามไปเอง ไม่ได้ UPDATE แถว)

-- AlterEnum
ALTER TYPE "RequestStatus" RENAME VALUE 'SENT' TO 'APPROVED';
ALTER TYPE "RequestStatus" ADD VALUE 'PENDING' BEFORE 'APPROVED';

ALTER TYPE "LogAction" ADD VALUE 'SUBMIT';
ALTER TYPE "LogAction" ADD VALUE 'APPROVE';
ALTER TYPE "LogAction" ADD VALUE 'REJECT';

ALTER TYPE "Role" ADD VALUE 'APPROVER' BEFORE 'ADMIN';

-- AlterTable
ALTER TABLE "ReportSetting" DROP COLUMN "approverName",
DROP COLUMN "approverTitle";

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approverId" TEXT,
ADD COLUMN     "requesterId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "title" TEXT;

-- DropTable
DROP TABLE "Signer";

-- DropEnum
DROP TYPE "SignerKind";

-- CreateIndex
CREATE INDEX "Request_approverId_status_idx" ON "Request"("approverId", "status");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- เขียนเอง: ผู้ลงนามที่เลือกจากตาราง Signer เดิมไม่มีบัญชีผู้ใช้ให้ผูก → ล้างกลับเป็นค่าเริ่มต้น
UPDATE "Request" SET "requesterName" = NULL, "requesterTitle" = NULL WHERE "requesterId" IS NULL;
UPDATE "Request" SET "approverName" = NULL, "approverTitle" = NULL WHERE "approverId" IS NULL;

-- เขียนเอง: เลือกผู้ลงนามแล้วต้องมีสำเนาชื่อคู่กันเสมอ
-- (ยังใช้ค่า 'PENDING' ใน CHECK ไม่ได้ — ค่า enum ที่เพิ่มใหม่ใช้ใน transaction เดียวกันไม่ได้ จึงบังคับ "รออนุมัติต้องมีผู้อนุมัติ" ในแอป)
ALTER TABLE "Request" ADD CONSTRAINT "Request_requester_snapshot"
  CHECK (("requesterId" IS NULL) = ("requesterName" IS NULL));
ALTER TABLE "Request" ADD CONSTRAINT "Request_approver_snapshot"
  CHECK (("approverId" IS NULL) = ("approverName" IS NULL));
