import { Banknote, Calculator, CircleCheck, Clock, Download, Eye, Inbox, Paperclip, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { DueBadge } from "@/components/DueBadge";
import { PhoneChargesNote } from "@/components/PhoneCharges";
import { ClickableRow } from "@/components/ClickableRow";
import { AmountCell, COLUMN, InvoiceCell, PeriodDueCell, ServiceCell, TwoLine } from "@/components/RequestCells";
import {
  Alert,
  Button,
  cx,
  EmptyRow,
  FilterSelect,
  NameCell,
  PageHeader,
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
import { beYear, formatThaiDate, thaiMonthName, toISODate, todayISO } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { PayForm } from "./PayForm";

const TABS = [
  { key: "pending", label: "รอจ่าย", icon: Clock, href: "/accounting" },
  { key: "paid", label: "จ่ายแล้ว", icon: CircleCheck, href: "/accounting?tab=paid" },
] as const;

export default async function AccountingPage({ searchParams }: PageProps<"/accounting">) {
  const user = await requireRole("ACCOUNTING", "ADMIN");
  const today = todayISO();

  const params = await searchParams;
  const tab = params.tab === "paid" ? "paid" : "pending";

  const pending = await db.request.findMany({
    where: { status: "APPROVED", deletedAt: null },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    include: { center: { select: { kind: true, name: true, customerCode: true } } },
  });
  const totalSatang = pending.reduce((sum, r) => sum + toSatang(r.amount), BigInt(0));
  const overdue = pending.filter((r) => daysUntil(today, toISODate(r.dueDate)) < 0).length;

  return (
    <>
      <PageHeader
        icon={Calculator}
        title="ฝ่ายบัญชี"
        description={user.role === "ACCOUNTING" ? "ใบเบิกที่อนุมัติแล้ว — ใกล้ครบกำหนดอยู่บนสุด" : "ใบที่อนุมัติแล้วรอจ่าย (ดูอย่างเดียว)"}
      />

      {params.paid && (
        <div className="mb-4">
          <Alert tone="success">บันทึกการจ่ายแล้ว ใบเบิกถูกล็อกเรียบร้อย</Alert>
        </div>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="รอจ่าย" value={pending.length} sub="ใบเบิก" icon={Wallet} tone="sky" />
        <StatCard
          label="ยอดรวมที่รอจ่าย"
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

      <nav className="mb-4 inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={tab === t.key ? "page" : undefined}
            className={cx(
              "flex items-center gap-1.5 rounded-md px-4 py-1.5",
              tab === t.key ? "bg-brand-700 font-medium text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <t.icon className="size-4" aria-hidden />
            {t.label}
            {t.key === "pending" && pending.length > 0 && (
              <span className={cx("rounded-full px-1.5 text-xs", tab === t.key ? "bg-white/20" : "bg-slate-100")}>{pending.length}</span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "pending" ? <PendingTable rows={pending} today={today} canPay={user.role === "ACCOUNTING"} /> : <PaidTable today={today} />}
    </>
  );
}

type PendingRow = Awaited<
  ReturnType<typeof db.request.findMany<{ include: { center: { select: { kind: true; name: true; customerCode: true } } } }>>
>[number];

function PendingTable({ rows, today, canPay }: { rows: PendingRow[]; today: string; canPay: boolean }) {
  return (
    <>
      {/* จอเล็ก: การ์ดทีละใบ */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => {
          const due = toISODate(r.dueDate);
          return (
            <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
              {canPay && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <PayAction row={r} today={today} suffix="-m" />
                </div>
              )}
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
            ไม่มีใบเบิกที่รอจ่าย
          </li>
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
                <th className={thClassDense}>{canPay ? "บันทึกการจ่าย" : ""}</th>
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
                      {canPay ? <PayAction row={r} today={today} /> : <span className="text-slate-300">–</span>}
                    </td>
                  </ClickableRow>
                );
              })}
              {rows.length === 0 && (
                <EmptyRow colSpan={5} icon={Inbox}>
                  ไม่มีใบเบิกที่รอจ่าย
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

// บันทึกการจ่ายทีละใบในแถวเลย: วันที่จ่าย (ค่าเริ่มต้นวันนี้) + ปุ่มบันทึก
function PayAction({ row, today, suffix }: { row: PendingRow; today: string; suffix?: string }) {
  return <PayForm id={row.id} today={today} returnTo="list" suffix={suffix} compact />;
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
    where: { status: "PAID", deletedAt: null, imported: false }, // ใบย้อนหลังที่นำเข้าจากตารางเดิมไม่ได้จ่ายผ่านระบบ
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
