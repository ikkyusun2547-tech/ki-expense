-- CreateTable
CREATE TABLE "ReportSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "department" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "requesterTitle" TEXT NOT NULL,
    "approverName" TEXT NOT NULL,
    "approverTitle" TEXT NOT NULL,
    "formCode" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSetting_pkey" PRIMARY KEY ("id")
);
