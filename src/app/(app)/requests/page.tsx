import Link from "next/link";
import type { RequestStatus } from "@/generated/prisma/enums";
import { RequestStatusBadge } from "@/components/StatusBadge";
import { Button, ButtonLink, inputClass, PageHeader, tableClass, tdClass, thClass } from "@/components/ui";
import { formatAmount } from "@/lib/money";
import { canCreateRequest, STATUS_LABEL } from "@/lib/status";
import { formatThaiDate, toISODate } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";

const STATUSES = Object.keys(STATUS_LABEL) as RequestStatus[];

export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const user = await requireRole("CREATOR", "ADMIN");

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = STATUSES.find((s) => s === params.status);

  const requests = await db.request.findMany({
    where: {
      deletedAt: null,
      ...(status && { status }),
      ...(q && {
        OR: [
          { invoiceNo: { contains: q, mode: "insensitive" } },
          { center: { customerCode: { contains: q, mode: "insensitive" } } },
          { center: { name: { contains: q, mode: "insensitive" } } },
        ],
      }),
    },
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
    include: { center: { select: { name: true, customerCode: true } } },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="ใบเบิก"
        description="ใบเบิกค่าอินเทอร์เน็ต 3BB ของทุกศูนย์ (แสดงล่าสุด 200 รายการ)"
        actions={canCreateRequest(user.role) && <ButtonLink href="/requests/new">+ สร้างใบเบิก</ButtonLink>}
      />

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="ค้นหาศูนย์ / รหัสลูกค้า / เลขที่ใบแจ้งหนี้" aria-label="ค้นหา" className={`${inputClass} max-w-sm`} />
        <select name="status" defaultValue={status ?? ""} aria-label="สถานะ" className={`${inputClass} w-auto`}>
          <option value="">ทุกสถานะ</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          ค้นหา
        </Button>
        {(q || status) && (
          <ButtonLink href="/requests" variant="ghost">
            ล้าง
          </ButtonLink>
        )}
      </form>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>ศูนย์</th>
              <th className={thClass}>รอบบริการ</th>
              <th className={thClass}>เลขที่ใบแจ้งหนี้</th>
              <th className={`${thClass} text-right`}>ยอด (บาท)</th>
              <th className={thClass}>ครบกำหนด</th>
              <th className={thClass}>สถานะ</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-50">
                <td className={tdClass}>
                  <div>{r.center.name}</div>
                  <div className="font-mono text-xs text-zinc-500">{r.center.customerCode}</div>
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  {formatThaiDate(toISODate(r.periodStart))} – {formatThaiDate(toISODate(r.periodEnd))}
                </td>
                <td className={`${tdClass} font-mono`}>{r.invoiceNo}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatAmount(r.amount)}</td>
                <td className={`${tdClass} whitespace-nowrap`}>{formatThaiDate(toISODate(r.dueDate))}</td>
                <td className={tdClass}>
                  <RequestStatusBadge status={r.status} />
                </td>
                <td className={`${tdClass} text-right`}>
                  <Link href={`/requests/${r.id}`} className="text-emerald-700 hover:underline">
                    ดู
                  </Link>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className={`${tdClass} py-8 text-center text-zinc-500`}>
                  {q || status ? "ไม่พบใบเบิกที่ตรงกับการค้นหา" : "ยังไม่มีใบเบิก"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
