import { ClickableRow } from "@/components/ClickableRow";
import { CalendarClock, CircleCheck, Clock, Download, Eye, Inbox, LayoutDashboard, Plus, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { DueBadge } from "@/components/DueBadge";
import { RequestStatusBadge } from "@/components/StatusBadge";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  EmptyRow,
  FilterSelect,
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
import type { ServiceKind } from "@/generated/prisma/enums";
import { kindHref } from "@/lib/auth/routes";
import { centerLabel } from "@/lib/centers/phone";
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

const KIND_TAB: Record<ServiceKind, { label: string; noun: string }> = {
  INTERNET: { label: "ค่าอินเทอร์เน็ต", noun: "ศูนย์" },
  PHONE: { label: "ค่าโทรศัพท์", noun: "เบอร์" },
};

export default async function SummaryPage({ searchParams }: PageProps<"/summary">) {
  const user = await requireUser();
  const today = todayISO();

  const params = await searchParams;
  const filter = STATES.find((s) => s === params.state);

  const all = await getCenterSummaries(today);
  const isCreator = canCreateRequest(user.role);

  // ผู้จัดทำ: เพิ่งส่งขออนุมัติจากฟอร์ม (กลับมาทำศูนย์ถัดไป) + ใบที่ยังไม่ส่ง/ถูกตีกลับ
  const sent =
    isCreator && typeof params.sent === "string"
      ? await db.request.findUnique({
          where: { id: params.sent },
          select: { id: true, approverName: true, center: { select: { name: true, kind: true } } },
        })
      : null;

  // ประเภทตามเมนู (?kind=) — ไม่ระบุ = ค่าอินเทอร์เน็ต (หน้าแรกของผู้จัดทำ)
  const kind: ServiceKind = params.kind === "PHONE" ? "PHONE" : "INTERNET";
  const rows = all.filter((r) => r.center.kind === kind);
  const noun = KIND_TAB[kind].noun;
  const href = (state?: CenterSummaryState) => `${kindHref("/summary", kind)}${state ? `&state=${state}` : ""}`;
  // ปีที่ดาวน์โหลดตารางรายปีได้: ตั้งแต่ปีของใบเบิกแรกจนถึงปีนี้ (ใหม่สุดก่อน)
  const firstDue = await db.request.findFirst({
    where: { deletedAt: null, center: { kind } },
    orderBy: { dueDate: "asc" },
    select: { dueDate: true },
  });
  const thisYear = Number(today.slice(0, 4));
  const fromYear = Math.min(thisYear, firstDue?.dueDate.getUTCFullYear() ?? thisYear);
  const years = Array.from({ length: thisYear - fromYear + 1 }, (_, i) => thisYear - i);
  const drafts = isCreator ? await db.request.count({ where: { status: "CREATED", deletedAt: null, createdById: user.id, center: { kind } } }) : 0;
  const shown = filter ? rows.filter((r) => r.state === filter) : rows;
  const countOf = (s: CenterSummaryState) => rows.filter((r) => r.state === s).length;

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title={kind === "PHONE" ? "สรุปรายเบอร์" : "สรุปรายศูนย์"}
        description={`${KIND_TAB[kind].label} · ${rows.length} ${noun} · ณ ${formatThaiDate(today, "long")}`}
      />

      {(sent || drafts > 0) && (
        <div className="mb-6 flex flex-col gap-3">
          {sent && (
            <Alert tone="success">
              ส่งใบเบิก <span className="font-semibold">{sent.center.name}</span> ให้ {sent.approverName} อนุมัติแล้ว — ทำ{noun}ถัดไปได้เลย ·{" "}
              <Link href={`/requests/${sent.id}`} className="font-medium underline">
                ดู/พิมพ์ใบเบิก
              </Link>
            </Alert>
          )}
          {drafts > 0 && (
            <Alert tone="warning">
              ใบเบิก{KIND_TAB[kind].label}ของคุณที่ยังไม่ส่งขออนุมัติ <span className="font-semibold">{drafts} ใบ</span> (รวมใบที่ผู้อนุมัติส่งกลับให้แก้) ·{" "}
              <Link href={`${kindHref("/requests", kind)}&status=CREATED`} className="font-medium underline">
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
            sub={s === "DUE_SOON" ? `ภายใน ${DUE_SOON_DAYS} วัน` : noun}
            icon={STATE[s].icon}
            tone={STATE[s].tone}
            href={filter === s ? href() : href(s)}
            active={filter === s}
          />
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {filter ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            แสดงเฉพาะ <Badge tone={STATE[filter].tone}>{STATE[filter].label}</Badge>
            <Link href={href()} className="font-medium text-brand-700 hover:underline">
              แสดงทั้งหมด
            </Link>
          </div>
        ) : (
          <span />
        )}
        {/* ตารางรายปีแบบที่เคยเขียนมือ (Excel) — ฟอร์ม GET ธรรมดา ไฟล์ดาวน์โหลดโดยไม่เปลี่ยนหน้า */}
        <form method="get" action="/api/reports/yearly" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="kind" value={kind} />
          <span className="text-sm text-slate-600">ตารางรายปี (Excel):</span>
          <FilterSelect name="year" label="ปี" defaultValue={String(thisYear)} options={years.map((y) => ({ value: String(y), label: `ปี ${y + 543}` }))} />
          <Button type="submit" variant="secondary" icon={Download}>
            ดาวน์โหลด
          </Button>
        </form>
      </div>

      {/* จอเล็ก: การ์ดทีละศูนย์/เบอร์ (ปุ่มสร้าง/ดูใบเบิกเห็นทันที) — จอใหญ่: ตาราง */}
      <ul className="flex flex-col gap-3 md:hidden">
        {shown.map((r) => (
          <li key={r.center.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <NameCell {...centerLabel(r.center)} />
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
            {filter ? `ไม่มี${noun}ในสถานะนี้` : `ยังไม่มี${noun}ที่ใช้งานอยู่ในทะเบียน`}
          </li>
        )}
      </ul>

      <div className="hidden md:block">
        <TableCard>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>{kind === "PHONE" ? "ผู้ใช้บริการ / เบอร์" : "ศูนย์"}</th>
                <th className={thClass}>ครบกำหนดรอบนี้</th>
                <th className={thClass}>สถานะ</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <SummaryRow key={r.center.id} href={rowActionHref(r, isCreator)}>
                  <td className={tdClass}>
                    <NameCell {...centerLabel(r.center)} />
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{formatThaiDate(r.dueDate)}</span>
                      {r.state !== "REQUESTED" && <DueBadge daysLeft={r.daysLeft} />}
                    </div>
                    <div className="mt-1.5 text-xs text-slate-400">ครบกำหนดทุกวันที่ {r.center.dueDay}</div>
                  </td>
                  <td className={tdClass}>
                    <StatusBadge row={r} />
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <RowAction row={r} isCreator={isCreator} />
                  </td>
                </SummaryRow>
              ))}
              {shown.length === 0 && (
                <EmptyRow colSpan={4} icon={Inbox}>
                  {filter ? `ไม่มี${noun}ในสถานะนี้` : `ยังไม่มี${noun}ที่ใช้งานอยู่ในทะเบียน`}
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

// เบิกแล้ว → ดูใบเบิก · ยังไม่เบิก → สร้างใบเบิก (เฉพาะผู้จัดทำ) · นอกนั้นไม่มีปุ่ม
function rowActionHref(row: Row, isCreator: boolean): string | null {
  if (row.request) return `/requests/${row.request.id}`;
  return isCreator ? `/requests/new?code=${encodeURIComponent(row.center.customerCode)}` : null;
}

// กดทั้งแถวได้เมื่อแถวมีปุ่ม (ไปที่เดียวกับปุ่ม)
function SummaryRow({ href, children }: { href: string | null; children: ReactNode }) {
  return href ? <ClickableRow href={href}>{children}</ClickableRow> : <tr className={rowClass}>{children}</tr>;
}

function RowAction({ row, isCreator, fullWidth }: { row: Row; isCreator: boolean; fullWidth?: boolean }) {
  const width = fullWidth ? "w-full" : "w-32";
  const href = rowActionHref(row, isCreator);
  if (!href) return null;
  if (row.request) {
    return (
      <ButtonLink href={href} variant="secondary" size="sm" icon={Eye} className={width}>
        ดูใบเบิก
      </ButtonLink>
    );
  }
  return (
    <ButtonLink href={href} size="sm" icon={Plus} className={width}>
      สร้างใบเบิก
    </ButtonLink>
  );
}
