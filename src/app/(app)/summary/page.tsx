import { CalendarClock, CircleCheck, Clock, FileText, Inbox, LayoutDashboard, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { DueBadge } from "@/components/DueBadge";
import { RequestStatusBadge } from "@/components/StatusBadge";
import {
  Alert,
  Badge,
  ButtonLink,
  EmptyRow,
  NameCell,
  PageHeader,
  rowClass,
  StatCard,
  TableCard,
  tableClass,
  tdClass,
  thClass,
  type BadgeTone,
  type IconType,
} from "@/components/ui";
import { DUE_SOON_DAYS, type CenterSummaryState } from "@/lib/rules/centerSummary";
import { canCreateRequest } from "@/lib/status";
import { formatThaiDate, todayISO } from "@/lib/thai/date";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { getCenterSummaries } from "@/server/services/summary";

const STATE: Record<CenterSummaryState, { label: string; short: string; tone: BadgeTone; icon: IconType }> = {
  OVERDUE: { label: "เลยกำหนด ยังไม่เบิก", short: "เลยกำหนด ยังไม่เบิก", tone: "red", icon: TriangleAlert },
  DUE_SOON: { label: "ใกล้ครบกำหนด ยังไม่เบิก", short: "ใกล้ครบกำหนด", tone: "amber", icon: CalendarClock },
  NOT_YET: { label: "ยังไม่ถึงรอบ", short: "ยังไม่ถึงรอบ", tone: "zinc", icon: Clock },
  REQUESTED: { label: "เบิกแล้ว", short: "เบิกแล้ว", tone: "green", icon: CircleCheck },
};

const STATES = Object.keys(STATE) as CenterSummaryState[];

export default async function SummaryPage({ searchParams }: PageProps<"/summary">) {
  const user = await requireUser();
  const today = todayISO();

  const params = await searchParams;
  const filter = STATES.find((s) => s === params.state);

  const rows = await getCenterSummaries(today);
  const isCreator = canCreateRequest(user.role);

  // ผู้จัดทำ: เพิ่งส่งขออนุมัติจากฟอร์ม (กลับมาทำศูนย์ถัดไป) + ใบที่ยังไม่ส่ง/ถูกตีกลับ
  const sent =
    isCreator && typeof params.sent === "string"
      ? await db.request.findUnique({ where: { id: params.sent }, select: { id: true, approverName: true, center: { select: { name: true } } } })
      : null;
  const drafts = isCreator ? await db.request.count({ where: { status: "CREATED", deletedAt: null } }) : 0;
  const shown = filter ? rows.filter((r) => r.state === filter) : rows;
  const countOf = (s: CenterSummaryState) => rows.filter((r) => r.state === s).length;

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="สรุปรายศูนย์"
        description={`${rows.length} ศูนย์ · ณ ${formatThaiDate(today, "long")}`}
      />

      {(sent || drafts > 0) && (
        <div className="mb-6 flex flex-col gap-3">
          {sent && (
            <Alert tone="success">
              ส่งใบเบิก <span className="font-semibold">{sent.center.name}</span> ให้ {sent.approverName} อนุมัติแล้ว — ทำศูนย์ถัดไปได้เลย ·{" "}
              <Link href={`/requests/${sent.id}`} className="font-medium underline">
                ดู/พิมพ์ใบเบิก
              </Link>
            </Alert>
          )}
          {drafts > 0 && (
            <Alert tone="warning">
              มีใบเบิกที่ยังไม่ส่งขออนุมัติ <span className="font-semibold">{drafts} ใบ</span> (รวมใบที่ผู้อนุมัติส่งกลับให้แก้) ·{" "}
              <Link href="/requests?status=CREATED" className="font-medium underline">
                ดูรายการ
              </Link>
            </Alert>
          )}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {STATES.map((s) => (
          <StatCard
            key={s}
            label={STATE[s].short}
            value={countOf(s)}
            sub={s === "DUE_SOON" ? `ภายใน ${DUE_SOON_DAYS} วัน` : "ศูนย์"}
            icon={STATE[s].icon}
            tone={STATE[s].tone}
            href={filter === s ? "/summary" : `/summary?state=${s}`}
            active={filter === s}
          />
        ))}
      </div>

      {filter && (
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
          แสดงเฉพาะ <Badge tone={STATE[filter].tone}>{STATE[filter].label}</Badge>
          <Link href="/summary" className="font-medium text-emerald-700 hover:underline">
            แสดงทั้งหมด
          </Link>
        </div>
      )}

      {/* จอเล็ก: การ์ดทีละศูนย์ (ปุ่มสร้าง/ดูใบเบิกเห็นทันที) — จอใหญ่: ตาราง */}
      <ul className="flex flex-col gap-3 md:hidden">
        {shown.map((r) => (
          <li key={r.center.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <NameCell name={r.center.name} code={r.center.customerCode} />
              <StatusBadge row={r} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
              ครบกำหนด {formatThaiDate(r.dueDate)}
              {r.state !== "REQUESTED" && <DueBadge daysLeft={r.daysLeft} />}
            </div>
            <div className="mt-3">
              <RowAction row={r} isCreator={isCreator} fullWidth />
            </div>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
            {filter ? "ไม่มีศูนย์ในสถานะนี้" : "ยังไม่มีศูนย์ที่ใช้งานอยู่ในทะเบียน"}
          </li>
        )}
      </ul>

      <div className="hidden md:block">
        <TableCard>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>ศูนย์</th>
                <th className={thClass}>ครบกำหนดรอบนี้</th>
                <th className={thClass}>สถานะ</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.center.id} className={rowClass}>
                  <td className={tdClass}>
                    <NameCell name={r.center.name} code={r.center.customerCode} />
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{formatThaiDate(r.dueDate)}</span>
                      {r.state !== "REQUESTED" && <DueBadge daysLeft={r.daysLeft} />}
                    </div>
                    <div className="text-xs text-slate-400">ครบกำหนดทุกวันที่ {r.center.dueDay}</div>
                  </td>
                  <td className={tdClass}>
                    <StatusBadge row={r} />
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <RowAction row={r} isCreator={isCreator} />
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <EmptyRow colSpan={4} icon={Inbox}>
                  {filter ? "ไม่มีศูนย์ในสถานะนี้" : "ยังไม่มีศูนย์ที่ใช้งานอยู่ในทะเบียน"}
                </EmptyRow>
              )}
            </tbody>
          </table>
        </TableCard>
      </div>
    </>
  );
}

type Row = Awaited<ReturnType<typeof getCenterSummaries>>[number];

// สถานะเดียว: ยังไม่เบิก → สถานะการเบิก (เลยกำหนด/ใกล้ครบ/ยังไม่ถึงรอบ) · เบิกแล้ว → สถานะของใบเบิกนั้น
function StatusBadge({ row }: { row: Row }) {
  return row.request ? <RequestStatusBadge status={row.request.status} /> : <Badge tone={STATE[row.state].tone}>{STATE[row.state].label}</Badge>;
}

// เบิกแล้ว → ดูใบเบิก · ยังไม่เบิก → สร้างใบเบิก (เฉพาะผู้จัดทำ)
function RowAction({ row, isCreator, fullWidth }: { row: Row; isCreator: boolean; fullWidth?: boolean }) {
  const width = fullWidth ? "w-full" : "w-32";
  if (row.request) {
    return (
      <ButtonLink href={`/requests/${row.request.id}`} variant="secondary" size="sm" icon={FileText} className={width}>
        ดูใบเบิก
      </ButtonLink>
    );
  }
  if (!isCreator) return null;
  return (
    <ButtonLink href={`/requests/new?code=${encodeURIComponent(row.center.customerCode)}`} size="sm" icon={Plus} className={width}>
      สร้างใบเบิก
    </ButtonLink>
  );
}
