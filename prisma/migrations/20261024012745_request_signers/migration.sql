-- CreateEnum
CREATE TYPE "SignerKind" AS ENUM ('REQUESTER', 'APPROVER');

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "approverName" TEXT,
ADD COLUMN     "approverTitle" TEXT,
ADD COLUMN     "requesterName" TEXT,
ADD COLUMN     "requesterTitle" TEXT;

-- CreateTable
CREATE TABLE "Signer" (
    "id" TEXT NOT NULL,
    "kind" "SignerKind" NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Signer_kind_name_key" ON "Signer"("kind", "name");

-- เขียนเอง: ชื่อกับตำแหน่งผู้ลงนามต้องมีคู่กัน (null ทั้งคู่ = ใช้ค่าเริ่มต้น)
ALTER TABLE "Request" ADD CONSTRAINT "Request_requester_pair"
  CHECK (("requesterName" IS NULL) = ("requesterTitle" IS NULL));
ALTER TABLE "Request" ADD CONSTRAINT "Request_approver_pair"
  CHECK (("approverName" IS NULL) = ("approverTitle" IS NULL));
