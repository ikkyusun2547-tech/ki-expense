import { CONTENT_TYPE, type InvoiceFileType } from "@/lib/files";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { readInvoiceFile } from "@/server/files";

// เปิดไฟล์ใบแจ้งหนี้ — ทุกบทบาทที่ล็อกอินดูได้ (บัญชีต้องใช้ตรวจก่อนจ่าย) แต่ต้องผ่าน session จริง
export async function GET(_request: Request, ctx: RouteContext<"/api/requests/[id]/invoice">) {
  await requireUser();

  const { id } = await ctx.params;
  const request = await db.request.findUnique({
    where: { id },
    select: { invoiceFileKey: true, invoiceFileName: true },
  });
  if (!request?.invoiceFileKey) return new Response("ไม่พบไฟล์ใบแจ้งหนี้", { status: 404 });

  const type = request.invoiceFileKey.split(".").pop() as InvoiceFileType;
  const body = await readInvoiceFile(request.invoiceFileKey);
  const fileName = encodeURIComponent(request.invoiceFileName ?? `invoice.${type}`);

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": CONTENT_TYPE[type],
      "Content-Disposition": `inline; filename*=UTF-8''${fileName}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
