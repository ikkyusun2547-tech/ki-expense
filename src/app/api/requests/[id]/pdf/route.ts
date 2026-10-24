import { buildMemo, chosenSignersOf } from "@/lib/pdf/memoData";
import { toISODate, todayISO } from "@/lib/thai/date";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { renderInternalMemo } from "@/server/pdf";

// ใบเบิก PDF (บันทึกภายใน FM-50000-02) สำหรับพิมพ์ไปเซ็น — ทุกบทบาทที่ล็อกอินเปิดได้ ยกเว้นใบที่ถูกลบ
export async function GET(_request: Request, ctx: RouteContext<"/api/requests/[id]/pdf">) {
  await requireUser();

  const { id } = await ctx.params;
  const request = await db.request.findUnique({
    where: { id },
    include: { center: { select: { name: true, customerCode: true } }, createdBy: { select: { name: true, title: true } } },
  });
  if (!request || request.deletedAt) return new Response("ไม่พบใบเบิกนี้", { status: 404 });

  const pdf = await renderInternalMemo(
    buildMemo({
      memoDate: todayISO(request.createdAt), // วันที่สร้างใบเบิก ตามเวลาไทย
      customerCode: request.center.customerCode,
      serviceUser: request.center.name,
      amount: request.amount,
      dueDate: toISODate(request.dueDate),
      creator: request.createdBy,
      signers: chosenSignersOf(request),
      approvedAt: request.approvedAt,
      texts: request, // จาก / เรียน / เพื่อ ของใบนี้
    }),
  );
  const fileName = encodeURIComponent(`ใบเบิก-${request.center.name}-${toISODate(request.dueDate)}.pdf`);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${fileName}`,
      "Cache-Control": "private, no-store",
    },
  });
}
