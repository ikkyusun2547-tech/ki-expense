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
        description={`สถานะการเบิกของศูนย์ที่ใช้งานอยู่ ${rows.length} ศูนย์ ณ วันที่ ${formatThaiDate(today, "long")}`}
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

      <TableCard>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>ศูนย์</th>
              <th className={`${thClass} text-center`}>ครบกำหนดทุกวันที่</th>
              <th className={thClass}>รอบที่ติดตาม</th>
              <th className={thClass}>สถานะการเบิก</th>
              <th className={thClass}>สถานะใบเบิก</th>
              <th className={thClass} />
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
                  {r.request ? <RequestStatusBadge status={r.request.status} /> : <span className="text-slate-300">–</span>}
                </td>
                {/* ปุ่มขนาด/ความกว้างเท่ากันทุกแถว ชิดขวา */}
                <td className={`${tdClass} text-right`}>
                  {r.request ? (
                    <ButtonLink href={`/requests/${r.request.id}`} variant="secondary" size="sm" icon={FileText} className="w-32">
                      ดูใบเบิก
                    </ButtonLink>
                  ) : (
                    isCreator && (
                      <ButtonLink
                        href={`/requests/new?code=${encodeURIComponent(r.center.customerCode)}`}
                        size="sm"
                        icon={Plus}
                        className="w-32"
                      >
                        สร้างใบเบิก
                      </ButtonLink>
                    )
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <EmptyRow colSpan={6} icon={Inbox}>
                {filter ? "ไม่มีศูนย์ในสถานะนี้" : "ยังไม่มีศูนย์ที่ใช้งานอยู่ในทะเบียน"}
              </EmptyRow>
            )}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
