import { Prisma } from "@/generated/prisma/client";

// P2002 = ชน unique constraint (เช่น รหัสลูกค้า/ชื่อผู้ใช้ซ้ำ)
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ชน exclusion constraint "Request_no_overlap" (รอบบริการทับกัน) — เกิดเมื่อมีคนบันทึกพร้อมกัน
// Prisma 7 + driver adapter ส่งรหัส PostgreSQL จริงมาใน meta.driverAdapterError.cause (23P01 = exclusion_violation)
export function isOverlapViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const cause = (error.meta?.driverAdapterError as { cause?: { originalCode?: string; originalMessage?: string } } | undefined)
    ?.cause;
  return cause?.originalCode === "23P01" && (cause.originalMessage ?? "").includes("Request_no_overlap");
}
