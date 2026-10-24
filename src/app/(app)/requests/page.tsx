import { CircleCheck, FilePlus, FileText, Hourglass, Inbox, Plus, Receipt, Send } from "lucide-react";
import type { RequestStatus } from "@/generated/prisma/enums";
import { RequestStatusBadge } from "@/components/StatusBadge";
import {
  Badge,
  Button,
  ButtonLink,
  EmptyRow,
  FilterBar,
  FilterSelect,
  NameCell,
  PageHeader,
  RowLink,
  rowClass,
  SearchInput,
  StatCard,
  TableCard,
  tableClass,
  tdClass,
  thClass,
  type BadgeTone,
  type IconType,
} from "@/components/ui";
import { formatAmount } from "@/lib/money";
import { canCreateRequest, returnedBy, STATUS_LABEL } from "@/lib/status";
import { formatThaiDate, toISODate } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";

const STATUSES = Object.keys(STATUS_LABEL) as RequestStatus[];

const STATUS_CARD: Record<RequestStatus, { icon: IconType; tone: BadgeTone; sub: string }> = {
  CREATED: { icon: FileText, tone: "zinc", sub: "รอส่งขออนุมัติ" },
  PENDING: { icon: Hourglass, tone: "amber", sub: "รอผู้อนุมัติ" },
  APPROVED: { icon: Send, tone: "sky", sub: "รอฝ่ายบัญชีจ่าย" },
  PAID: { icon: CircleCheck, tone: "green", sub: "เสร็จสิ้น" },
};

export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const user = await requireRole("CREATOR", "ADMIN");

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = STATUSES.find((s) => s === params.status);

  const [requests, counts] = await Promise.all([
    db.request.findMany({
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
      include: {
        center: { select: { name: true, customerCode: true } },
        // การกระทำล่าสุดในเส้นทางอนุมัติ — ไว้บอกว่าใบ "สร้างแล้ว" ใบไหนถูกตีกลับ
        logs: {
          where: { action: { in: ["SUBMIT", "APPROVE", "REJECT", "REVERT"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { action: true },
        },
      },
      take: 200,
    }),
    db.request.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
  ]);
  const countOf = (s: RequestStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const filterHref = (s: RequestStatus) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(status !== s && { status: s }) });
    return p.size ? `/requests?${p}` : "/requests";
  };

  return (
    <>
      <PageHeader
        icon={Receipt}
        title="ใบเบิก"
        description="ใบเบิกทุกศูนย์ (ล่าสุด 200 ใบ)"
        actions={
          canCreateRequest(user.role) && (
            <ButtonLink href="/requests/new" icon={Plus}>
              สร้างใบเบิก
            </ButtonLink>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {STATUSES.map((s) => (
          <StatCard
            key={s}
            label={STATUS_LABEL[s]}
            value={countOf(s)}
            sub={STATUS_CARD[s].sub}
            icon={STATUS_CARD[s].icon}
            tone={STATUS_CARD[s].tone}
            href={filterHref(s)}
            active={status === s}
          />
        ))}
      </div>

      <FilterBar>
        <SearchInput defaultValue={q} placeholder="ค้นหาศูนย์ / รหัสลูกค้า / เลขที่ใบแจ้งหนี้" />
        <FilterSelect
          name="status"
          label="สถานะ"
          defaultValue={status}
          options={[{ value: "", label: "ทุกสถานะ" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
            ค้นหา
          </Button>
          {(q || status) && (
            <ButtonLink href="/requests" variant="ghost">
              ล้างตัวกรอง
            </ButtonLink>
          )}
        </div>
      </FilterBar>

      <TableCard>
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
              <tr key={r.id} className={rowClass}>
                <td className={tdClass}>
                  <NameCell name={r.center.name} code={r.center.customerCode} href={`/requests/${r.id}`} />
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  {formatThaiDate(toISODate(r.periodStart))} – {formatThaiDate(toISODate(r.periodEnd))}
                </td>
                <td className={`${tdClass} tabular-nums`}>{r.invoiceNo}</td>
                <td className={`${tdClass} text-right font-semibold tabular-nums text-slate-900`}>{formatAmount(r.amount)}</td>
                <td className={`${tdClass} whitespace-nowrap`}>{formatThaiDate(toISODate(r.dueDate))}</td>
                <td className={tdClass}>
                  <div className="flex flex-wrap items-center gap-1">
                    <RequestStatusBadge status={r.status} />
                    {returnedBy(r.status, r.logs) && <Badge tone="red">ถูกตีกลับ</Badge>}
                  </div>
                </td>
                <td className={`${tdClass} text-right`}>
                  <RowLink href={`/requests/${r.id}`}>ดู</RowLink>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <EmptyRow colSpan={7} icon={q || status ? Inbox : FilePlus}>
                {q || status ? "ไม่พบใบเบิกที่ตรงกับการค้นหา" : "ยังไม่มีใบเบิก — กด \"สร้างใบเบิก\" เพื่อเริ่ม"}
              </EmptyRow>
            )}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
