import { ArrowRightLeft, Building, CircleCheck, CircleX, Inbox, Plus } from "lucide-react";
import type { CenterStatus } from "@/generated/prisma/enums";
import { CenterStatusBadge } from "@/components/StatusBadge";
import {
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
import { CENTER_STATUS_LABEL } from "@/lib/status";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";

const STATUSES = Object.keys(CENTER_STATUS_LABEL) as CenterStatus[];

const STATUS_CARD: Record<CenterStatus, { icon: IconType; tone: BadgeTone; sub: string }> = {
  ACTIVE: { icon: CircleCheck, tone: "green", sub: "เบิกได้ตามปกติ" },
  MOVED: { icon: ArrowRightLeft, tone: "amber", sub: "เบิกไม่ได้" },
  CLOSED: { icon: CircleX, tone: "zinc", sub: "เบิกไม่ได้" },
};

export default async function CentersPage({ searchParams }: PageProps<"/admin/centers">) {
  await requireRole("ADMIN");

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = STATUSES.find((s) => s === params.status);

  const [centers, counts] = await Promise.all([
    db.center.findMany({
      where: {
        ...(status && { status }),
        ...(q && {
          OR: [
            { customerCode: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { serviceNumber: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { customerCode: "asc" },
      include: { _count: { select: { requests: true } } },
    }),
    db.center.groupBy({ by: ["status"], _count: true }),
  ]);

  const total = counts.reduce((sum, c) => sum + c._count, 0);
  const countOf = (s: CenterStatus) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageHeader
        icon={Building}
        title="ทะเบียนศูนย์"
        description={`ทั้งหมด ${total} ศูนย์`}
        actions={
          <ButtonLink href="/admin/centers/new" icon={Plus}>
            เพิ่มศูนย์
          </ButtonLink>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        {STATUSES.map((s) => (
          <StatCard
            key={s}
            label={CENTER_STATUS_LABEL[s]}
            value={countOf(s)}
            sub={STATUS_CARD[s].sub}
            icon={STATUS_CARD[s].icon}
            tone={STATUS_CARD[s].tone}
            href={status === s ? "/admin/centers" : `/admin/centers?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            active={status === s}
          />
        ))}
      </div>

      <FilterBar>
        <SearchInput defaultValue={q} placeholder="ค้นหารหัสลูกค้า / ชื่อศูนย์ / หมายเลขบริการ" />
        <FilterSelect
          name="status"
          label="สถานะ"
          defaultValue={status}
          options={[{ value: "", label: "ทุกสถานะ" }, ...STATUSES.map((s) => ({ value: s, label: CENTER_STATUS_LABEL[s] }))]}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
            ค้นหา
          </Button>
          {(q || status) && (
            <ButtonLink href="/admin/centers" variant="ghost">
              ล้างตัวกรอง
            </ButtonLink>
          )}
        </div>
      </FilterBar>

      <TableCard>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>ศูนย์ / รหัสลูกค้า</th>
              <th className={thClass}>หมายเลขบริการ</th>
              <th className={`${thClass} text-right`}>ยอดปกติ (บาท)</th>
              <th className={`${thClass} text-center`}>ครบกำหนดทุกวันที่</th>
              <th className={thClass}>สถานะ</th>
              <th className={`${thClass} text-right`}>ใบเบิก</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {centers.map((c) => (
              <tr key={c.id} className={rowClass}>
                <td className={tdClass}>
                  <NameCell name={c.name} code={c.customerCode} href={`/admin/centers/${c.id}`} />
                </td>
                <td className={`${tdClass} tabular-nums text-slate-500`}>{c.serviceNumber ?? "–"}</td>
                <td className={`${tdClass} text-right font-semibold tabular-nums text-slate-900`}>{formatAmount(c.normalAmount)}</td>
                <td className={`${tdClass} text-center tabular-nums`}>{c.dueDay}</td>
                <td className={tdClass}>
                  <CenterStatusBadge status={c.status} />
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>{c._count.requests}</td>
                <td className={`${tdClass} text-right`}>
                  <RowLink href={`/admin/centers/${c.id}`}>แก้ไข</RowLink>
                </td>
              </tr>
            ))}
            {centers.length === 0 && (
              <EmptyRow colSpan={7} icon={Inbox}>
                {q || status ? "ไม่พบศูนย์ที่ตรงกับการค้นหา" : "ยังไม่มีศูนย์ในทะเบียน — กด \"เพิ่มศูนย์\" เพื่อเริ่ม"}
              </EmptyRow>
            )}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
