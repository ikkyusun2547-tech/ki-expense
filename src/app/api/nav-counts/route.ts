import { todayISO } from "@/lib/thai/date";
import { requireUser } from "@/server/auth";
import { getNavCounts } from "@/server/services/navCounts";

// ตัวเลขงานค้างบนแถบเมนู — แถบเมนูอยู่ใน layout ซึ่งไม่ render ใหม่ตอนเปลี่ยนหน้า จึงให้ฝั่งเบราว์เซอร์ดึงใหม่เอง
export async function GET() {
  const user = await requireUser();
  return Response.json(await getNavCounts(user, todayISO()), { headers: { "Cache-Control": "private, no-store" } });
}
