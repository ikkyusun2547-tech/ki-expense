import { buildMemo } from "@/lib/pdf/memoData";
import { requireRole } from "@/server/auth";
import { renderInternalMemo } from "@/server/pdf";
import { previewMemoInput } from "@/server/services/requests";

// ดูตัวอย่างใบเบิก PDF จากข้อมูลในฟอร์ม "ก่อนบันทึก" (ผู้ใช้ขอ 2026-10-31) — ไม่เขียนอะไรลง DB, PDF มีลายน้ำ "ตัวอย่าง"
// รับ FormData ชุดเดียวกับฟอร์มสร้าง/แก้ใบเบิก; ข้อมูลไม่พอพิมพ์ → 400 พร้อมข้อความไทย (ฟอร์มแสดงให้ผู้ใช้)
export async function POST(request: Request) {
  const actor = await requireRole("CREATOR");
  const form = await request.formData();
  const text = (key: string) => String(form.get(key) ?? "");

  const result = await previewMemoInput({
    actor,
    centerId: text("centerId"),
    requestId: text("id") || undefined,
    amount: text("amount"),
    packageAmount: text("packageAmount"),
    extraAmount: text("extraAmount"),
    periodEnd: text("periodEnd"),
    dueDate: text("dueDate"),
    approverId: text("approverId") || null,
    requesterId: text("requesterId") || null,
    texts: { department: text("department").trim(), recipient: text("recipient").trim(), purpose: text("purpose").trim() },
  });
  if (!result.ok) return new Response(result.error, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  const pdf = await renderInternalMemo(buildMemo(result.input), { preview: true });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent("ตัวอย่างใบเบิก.pdf")}`,
      "Cache-Control": "private, no-store",
    },
  });
}
