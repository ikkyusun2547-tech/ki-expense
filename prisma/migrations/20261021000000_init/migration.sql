-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CREATOR', 'ACCOUNTING', 'ADMIN');

-- CreateEnum
CREATE TYPE "CenterStatus" AS ENUM ('ACTIVE', 'MOVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('CREATED', 'SENT', 'PAID');

-- CreateEnum
CREATE TYPE "LogAction" AS ENUM ('CREATE', 'EDIT', 'DELETE', 'SEND', 'PAY', 'REVERT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Center" (
    "id" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "serviceNumber" TEXT,
    "name" TEXT NOT NULL,
    "normalAmount" DECIMAL(12,2) NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "status" "CenterStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Center_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'CREATED',
    "paidDate" DATE,
    "paymentRef" TEXT,
    "invoiceFileKey" TEXT,
    "invoiceFileName" TEXT,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "action" "LogAction" NOT NULL,
    "fromStatus" "RequestStatus",
    "toStatus" "RequestStatus",
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Center_customerCode_key" ON "Center"("customerCode");

-- CreateIndex
CREATE INDEX "Request_centerId_periodStart_idx" ON "Request"("centerId", "periodStart");

-- CreateIndex
CREATE INDEX "Request_status_dueDate_idx" ON "Request"("status", "dueDate");

-- CreateIndex
CREATE INDEX "ApprovalLog_requestId_createdAt_idx" ON "ApprovalLog"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLog" ADD CONSTRAINT "ApprovalLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLog" ADD CONSTRAINT "ApprovalLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- =====================================================================
-- ส่วนที่เขียนเอง: กฎที่ Prisma schema แสดงไม่ได้
-- =====================================================================

-- ค่าในทะเบียนศูนย์
ALTER TABLE "Center" ADD CONSTRAINT "Center_dueDay_check" CHECK ("dueDay" BETWEEN 1 AND 31);
ALTER TABLE "Center" ADD CONSTRAINT "Center_normalAmount_check" CHECK ("normalAmount" >= 0);

-- ค่าในใบเบิก
ALTER TABLE "Request" ADD CONSTRAINT "Request_amount_check" CHECK ("amount" > 0);
ALTER TABLE "Request" ADD CONSTRAINT "Request_period_check" CHECK ("periodEnd" >= "periodStart");
ALTER TABLE "Request" ADD CONSTRAINT "Request_paid_check" CHECK ("status" <> 'PAID' OR "paidDate" IS NOT NULL);

-- กันเบิกซ้ำ: ศูนย์เดียวกัน รอบบริการทับซ้อนกัน (รวมวันขอบ) ห้ามมีมากกว่า 1 ใบ
-- ใบที่ soft delete แล้วไม่นับ
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Request" ADD CONSTRAINT "Request_no_overlap"
  EXCLUDE USING gist (
    "centerId" WITH =,
    daterange("periodStart", "periodEnd", '[]') WITH &&
  ) WHERE ("deletedAt" IS NULL);

-- ApprovalLog เพิ่มอย่างเดียว
CREATE FUNCTION approval_log_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ApprovalLog is append-only: % is not allowed', TG_OP;
END;
$$;

CREATE TRIGGER "ApprovalLog_no_update_delete"
  BEFORE UPDATE OR DELETE ON "ApprovalLog"
  FOR EACH ROW EXECUTE FUNCTION approval_log_append_only();

CREATE TRIGGER "ApprovalLog_no_truncate"
  BEFORE TRUNCATE ON "ApprovalLog"
  FOR EACH STATEMENT EXECUTE FUNCTION approval_log_append_only();
