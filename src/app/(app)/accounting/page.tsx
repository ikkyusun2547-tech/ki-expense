import { Banknote, Calculator, CircleCheck, Clock, Download, Eye, Inbox, Paperclip, TriangleAlert, Wallet } from "lucide-react";
import type { RequestStatus } from "@/generated/prisma/enums";
import { DueBadge } from "@/components/DueBadge";
import { PhoneChargesNote } from "@/components/PhoneCharges";
import { ClickableRow } from "@/components/ClickableRow";
import { AmountCell, COLUMN, InvoiceCell, PeriodDueCell, ServiceCell, TwoLine } from "@/components/RequestCells";
import {
  Alert,
  Button,
  EmptyRow,
  FilterSelect,
  NameCell,
  PageHeader,
  PillTabs,
  RowLink,
  StatCard,
  TableCard,
  tableClass,
  tdClass,
  tdClassDense,
  thClass,
  thClassDense,
} from "@/components/ui";
import { centerLabel, kindTag } from "@/lib/centers/phone";
import { formatAmount, toSatang } from "@/lib/money";
import { daysUntil } from "@/lib/rules/centerSummary";
import { beYear, formatThaiDate, formatThaiDateTime, thaiHour, thaiMonthName, toISODate, todayISO } from "@/lib/thai/date";
import { greeting } from "@/lib/thai/name";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { PayForm } from "./PayForm";
import { ReceiveButton } from "./ReceiveButton";

// ใบเบิกเป็นกระดาษ: อนุมัติแล้ว → บัญชีกด "รับเอกสาร" เมื่อกระดาษมาถึง → บันทึกจ่าย
const TABS = [
  { key: "receive", label: "รอรับเอกสาร", icon: Inbox, href: "/accounting" },
  { key: "pay", label: "รอจ่าย", icon: Clock, href: "/accounting?tab=pay" },
  { key: "paid", label: "จ่ายแล้ว", icon: CircleCheck, href: "/accounting?tab=paid" },
] as const;

type QueueTab = "receive" | "pay";
const QUEUE_STATUS: Record<QueueTab, RequestStatus> = { receive: "APPROVED", pay: "RECEIVED" };
const QUEUE_EMPTY: Record<QueueTab, string> = { receive: "ไม่มีใบเบิกที่รอรับเอกสาร", pay: "ไม่มีใบเบิกที่รอจ่าย" };

export default async function AccountingPage({ searchParams }: PageProps<"/accounting">) {
  const user = await requireRole("ACCOUNTING", "ADMIN");
  const today = todayISO();

  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.tab)?.key ?? "receive";
  const canAct = user.role === "ACCOUNTING";

  // ใบที่ยังไม่จ่ายทั้งหมด (รอรับเอกสาร + รอจ่าย) — ใกล้ครบกำหนดอยู่บนสุด
  const open = await db.request.findMany({
    where: { status: { in: ["APPROVED", "RECEIVED"] }, deletedAt: null },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    include: { center: { select: { kind: true, name: true, customerCode: true } } },
  });
  const queue = (t: QueueTab) => open.filter((r) => r.status === QUEUE_STATUS[t]);
  const counts: Record<string, number> = { receive: queue("receive").length, pay: queue("pay").length };
  const totalSatang = open.reduce((sum, r) => sum + toSatang(r.amount), BigInt(0));
  const overdue = open.filter((r) => daysUntil(today, toISODate(r.dueDate)) < 0).length;

  return (
    <>
      <PageHeader
        icon={Calculator}
        greeting={greeting(user.name, thaiHour())}
        title="ฝ่ายบัญชี"
        description={canAct ? "ได้รับใบเบิกกระดาษแล้วกด “รับเอกสาร” จากนั้นบันทึกจ่าย — ใกล้ครบกำหนดอยู่บนสุด" : "ใบที่อนุมัติแล้ว รอรับเอกสาร/รอจ่าย (ดูอย่างเดียว)"}
      />

      {(params.paid || params.received) && (
        <div className="mb-4">
          <Alert tone="success">{params.paid ? "บันทึกการจ่ายแล้ว ใบเบิกถูกล็อกเรียบร้อย" : "รับเอกสารแล้ว — ใบเบิกย้ายไปแท็บ “รอจ่าย”"}</Alert>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="รอรับเอกสาร" value={counts.receive} sub="อนุมัติแล้ว กระดาษยังไม่ถึง" icon={Inbox} tone="sky" href="/accounting" active={tab === "receive"} />
        <StatCard label="รอจ่าย" value={counts.pay} sub="รับเอกสารแล้ว" icon={Wallet} tone="violet" href="/accounting?tab=pay" active={tab === "pay"} />
        <StatCard
          label="ยอดรวมที่ยังไม่จ่าย"
          value={formatAmount(`${totalSatang / BigInt(100)}.${String(totalSatang % BigInt(100)).padStart(2, "0")}`)}
          sub="บาท"
          icon={Banknote}
          tone="green"
        />
        <StatCard
          label="เลยวันครบกำหนดแล้ว"
          value={overdue}
          sub={overdue ? "ควรจ่ายโดยเร็ว" : "ไม่มีรายการค้าง"}
          icon={TriangleAlert}
          tone={overdue ? "red" : "zinc"}
        />
      </div>

      <PillTabs
        label="มุมมอง"
        tabs={TABS.map((t) => ({ href: t.href, label: t.label, icon: t.icon, count: counts[t.key], active: tab === t.key }))}
      />

      {tab === "paid" ? <PaidTable today={today} /> : <QueueTable tab={tab} rows={queue(tab)} today={today} canAct={canAct} />}
    </>
  );
}

type PendingRow = Awaited<
  ReturnType<typeof db.request.findMany<{ include: { center: { select: { kind: true; name: true; customerCode: true } } } }>>
>[number];

// รอรับเอกสาร: ผู้อนุมัติ/เวลาอนุมัติ + ปุ่มรับเอกสาร / รอจ่าย: เวลารับเอกสาร + วันที่จ่าย + ปุ่มบันทึกจ่าย
function QueueTable({ tab, rows, today, canAct }: { tab: QueueTab; rows: PendingRow[]; today: string; canAct: boolean }) {
  const receive = tab === "receive";
  const action = (r: PendingRow, suffix?: string) =>
    receive ? <ReceiveButton id={r.id} returnTo="list" /> : <PayForm id={r.id} today={today} returnTo="list" suffix={suffix} compact />;
  return (
    <>
      {/* จอเล็ก: การ์ดทีละใบ */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => {
          const due = toISODate(r.dueDate);
          return (
            <li key={r.id} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <NameCell {...centerLabel(r.center)} tag={kindTag(r.center)} href={`/requests/${r.id}`} />
                <div className="text-right">
                  <div className="text-lg font-bold tabular-nums text-slate-900">{formatAmount(r.amount)}</div>
                  <div className="text-xs text-slate-500">บาท</div>
                  <PhoneChargesNote request={r} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                ครบกำหนด {formatThaiDate(due)} <DueBadge daysLeft={daysUntil(today, due)} />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  ใบแจ้งหนี้ <span className="tabular-nums">{r.invoiceNo}</span> · <FileLink row={r} />
                </span>
                <RowLink href={`/requests/${r.id}`} icon={Eye}>ดู</RowLink>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                <Progress row={r} />
              </div>
              {canAct && <div className="mt-3 border-t border-slate-100 pt-3">{action(r, "-m")}</div>}
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="rounded-2xl border border-slate-200/70 bg-white px-4 py-12 text-center text-sm text-slate-500">{QUEUE_EMPTY[tab]}</li>
        )}
      </ul>

      {/* จอใหญ่: ตาราง — คอลัมน์ละเรื่องตามมาตรฐาน RequestCells */}
      <div className="hidden md:block">
        <TableCard>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClassDense}>{COLUMN.service}</th>
                <th className={thClassDense}>{COLUMN.invoice}</th>
                <th className={thClassDense}>{COLUMN.periodDue}</th>
                <th className={`${thClassDense} text-right`}>{COLUMN.amount}</th>
                <th className={thClassDense}>{receive ? "อนุมัติโดย" : "บัญชีรับแล้ว"}</th>
                {canAct && <th className={thClassDense}>{receive ? "รับเอกสาร" : "บันทึกการจ่าย"}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                return (
                  <ClickableRow key={r.id} href={`/requests/${r.id}`}>
                    <td className={tdClassDense}>
                      <ServiceCell center={r.center} href={`/requests/${r.id}`} />
                    </td>
                    <td className={tdClassDense}>
                      <InvoiceCell id={r.id} invoiceNo={r.invoiceNo} hasFile={!!r.invoiceFileKey} />
                    </td>
                    <td className={tdClassDense}>
                      <PeriodDueCell periodStart={r.periodStart} periodEnd={r.periodEnd} dueDate={r.dueDate} today={today} />
                    </td>
                    <td className={tdClassDense}>
                      <AmountCell request={r} />
                    </td>
                    <td className={tdClassDense}>
                      <Progress row={r} twoLine />
                    </td>
                    {canAct && <td className={tdClassDense}>{action(r)}</td>}
                  </ClickableRow>
                );
              })}
              {rows.length === 0 && (
                <EmptyRow colSpan={canAct ? 6 : 5} icon={Inbox}>
                  {QUEUE_EMPTY[tab]}
                </EmptyRow>
              )}
            </tbody>
          </table>
        </TableCard>
      </div>
    </>
  );
}

function FileLink({ row }: { row: PendingRow }) {
  if (!row.invoiceFileKey) return <span className="text-amber-700">ไม่มีไฟล์</span>;
  return (
    <a
      href={`/api/requests/${row.id}/invoice`}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-brand-700 hover:underline"
    >
      <Paperclip className="size-3.5" aria-hidden /> เปิดไฟล์
    </a>
  );
}

// ความคืบหน้าของเอกสาร: รอรับ = ใครอนุมัติ/เมื่อไร (ไว้ตามกระดาษ), รอจ่าย = รับเอกสารเมื่อไร
function Progress({ row, twoLine = false }: { row: PendingRow; twoLine?: boolean }) {
  const approved = row.status === "APPROVED";
  const at = approved ? row.approvedAt : row.receivedAt;
  const main = approved ? (row.approverName ?? "–") : "รับเอกสารแล้ว";
  const sub = at && `${formatThaiDateTime(at)} น.`;
  if (twoLine) return <TwoLine main={main} sub={sub} />;
  return (
    <>
      {approved ? `อนุมัติโดย ${main}` : main}
      {sub && ` · ${sub}`}
    </>
  );
}

// 12 เดือนล่าสุด (นับจากเดือนนี้) สำหรับเลือกเดือนที่จะดาวน์โหลด — "YYYY-MM"
function recentMonths(today: string): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

async function PaidTable({ today }: { today: string }) {
  const requests = await db.request.findMany({
    where: { status: "PAID", deletedAt: null },
    orderBy: [{ paidDate: "desc" }, { updatedAt: "desc" }],
    include: { center: { select: { kind: true, name: true, customerCode: true } } },
    take: 100,
  });

  return (
    <>
      {/* ดาวน์โหลดสรุปการจ่ายรายเดือน (CSV เปิดด้วย Excel) — ฟอร์ม GET ธรรมดา ไฟล์ดาวน์โหลดโดยไม่เปลี่ยนหน้า */}
      <form method="get" action="/api/reports/payments" className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">สรุปการจ่ายเป็นไฟล์ Excel:</span>
        <FilterSelect
          name="month"
          label="เดือน"
          defaultValue={today.slice(0, 7)}
          options={recentMonths(today).map((m) => ({ value: m, label: `${thaiMonthName(`${m}-01`)} ${beYear(`${m}-01`)}` }))}
        />
        <Button type="submit" variant="secondary" icon={Download}>
          ดาวน์โหลด
        </Button>
      </form>
      <TableCard>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>{COLUMN.service}</th>
              <th className={thClass}>{COLUMN.invoice}</th>
              <th className={thClass}>{COLUMN.periodDue}</th>
              <th className={`${thClass} text-right`}>{COLUMN.amount}</th>
              <th className={thClass}>จ่ายแล้ว</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <ClickableRow key={r.id} href={`/requests/${r.id}`}>
                <td className={tdClass}>
                  <ServiceCell center={r.center} href={`/requests/${r.id}`} />
                </td>
                <td className={tdClass}>
                  <InvoiceCell id={r.id} invoiceNo={r.invoiceNo} hasFile={!!r.invoiceFileKey} />
                </td>
                <td className={tdClass}>
                  <PeriodDueCell periodStart={r.periodStart} periodEnd={r.periodEnd} dueDate={r.dueDate} />
                </td>
                <td className={tdClass}>
                  <AmountCell request={r} />
                </td>
                <td className={tdClass}>
                  <TwoLine main={r.paidDate && formatThaiDate(toISODate(r.paidDate))} sub={r.paymentRef && `อ้างอิง ${r.paymentRef}`} />
                </td>
              </ClickableRow>
            ))}
            {requests.length === 0 && (
              <EmptyRow colSpan={5} icon={Inbox}>
                ยังไม่มีใบเบิกที่จ่ายแล้ว
              </EmptyRow>
            )}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
