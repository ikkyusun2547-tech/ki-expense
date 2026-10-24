import { CalendarClock, CircleCheck, Clock, Inbox, LayoutDashboard, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { DueBadge } from "@/components/DueBadge";
import { RequestStatusBadge } from "@/components/StatusBadge";
import {
  Badge,
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
import { getCenterSummaries } from "@/server/services/summary";

const STATE: Record<CenterSummaryState, { label: string; short: string; tone: BadgeTone; icon: IconType }> = {
  OVERDUE: { label: "เลยกำหนด ยังไม่เบิก", short: "เลยกำหนด ยังไม่เบิก", tone: "red", icon: TriangleAlert },
  DUE_SOON: { label: "ใกล้ครบกำหนด ยังไม่เบิก", short: `ใกล้ครบกำหนด (≤ ${DUE_SOON_DAYS} วัน)`, tone: "amber", icon: CalendarClock },
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
  const shown = filter ? rows.filter((r) => r.state === filter) : rows;
  const countOf = (s: CenterSummaryState) => rows.filter((r) => r.state === s).length;

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="สรุปรายศูนย์"
        description={`สถานะการเบิกของศูนย์ที่ใช้งานอยู่ ${rows.length} ศูนย์ ณ วันที่ ${formatThaiDate(today, "long")}`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {STATES.map((s) => (
          <StatCard
            key={s}
            label={STATE[s].short}
            value={countOf(s)}
            sub="ศูนย์ · กดเพื่อกรอง"
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

      <TableCard>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>ศูนย์</th>
              <th className={`${thClass} text-center`}>ครบกำหนดทุกวันที่</th>
              <th className={thClass}>รอบที่ติดตาม</th>
              <th className={thClass}>สถานะการเบิก</th>
              <th className={thClass}>ใบเบิก</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.center.id} className={rowClass}>
                <td className={tdClass}>
                  <NameCell name={r.center.name} code={r.center.customerCode} />
                </td>
                <td className={`${tdClass} text-center tabular-nums`}>{r.center.dueDay}</td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  <div className="flex flex-col items-start gap-1">
                    <span>{formatThaiDate(r.dueDate)}</span>
                    {r.state !== "REQUESTED" && <DueBadge daysLeft={r.daysLeft} />}
                  </div>
                </td>
                <td className={tdClass}>
                  <Badge tone={STATE[r.state].tone}>{STATE[r.state].label}</Badge>
                </td>
                <td className={tdClass}>
                  {r.request ? (
                    <Link href={`/requests/${r.request.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:underline">
                      <RequestStatusBadge status={r.request.status} /> ดูใบเบิก
                    </Link>
                  ) : canCreateRequest(user.role) ? (
                    <Link
                      href={`/requests/new?code=${encodeURIComponent(r.center.customerCode)}`}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                    >
                      <Plus className="size-3.5" aria-hidden /> สร้างใบเบิก
                    </Link>
                  ) : (
                    <span className="text-slate-300">–</span>
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <EmptyRow colSpan={5} icon={Inbox}>
                {filter ? "ไม่มีศูนย์ในสถานะนี้" : "ยังไม่มีศูนย์ที่ใช้งานอยู่ในทะเบียน"}
              </EmptyRow>
            )}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
