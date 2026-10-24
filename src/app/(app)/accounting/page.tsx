import { Banknote, Calculator, CircleCheck, Clock, Inbox, Paperclip, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { DueBadge } from "@/components/DueBadge";
import { Alert, cx, EmptyRow, NameCell, PageHeader, rowClass, StatCard, TableCard, tableClass, tdClass, thClass } from "@/components/ui";
import { formatAmount, toSatang } from "@/lib/money";
import { daysUntil } from "@/lib/rules/centerSummary";
import { formatThaiDate, toISODate, todayISO } from "@/lib/thai/date";
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
    include: { center: { select: { name: true, customerCode: true } } },
  });
  const totalSatang = pending.reduce((sum, r) => sum + toSatang(r.amount), BigInt(0));
  const overdue = pending.filter((r) => daysUntil(today, toISODate(r.dueDate)) < 0).length;

  return (
    <>
      <PageHeader
        icon={Calculator}
        title="ฝ่ายบัญชี"
        description={
          user.role === "ACCOUNTING"
            ? "ใบเบิกที่ผู้อนุมัติอนุมัติแล้ว เรียงตามวันครบกำหนดใกล้สุด — บันทึกวันที่จ่ายจริงและเลขอ้างอิงเมื่อจ่ายแล้ว"
            : "ใบเบิกที่อนุมัติแล้วรอจ่าย (admin ดูได้ แต่บันทึกการจ่ายได้เฉพาะฝ่ายบัญชี)"
        }
      />

      {params.paid === "1" && (
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
              tab === t.key ? "bg-emerald-700 font-medium text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
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

      {tab === "pending" ? <PendingTable rows={pending} today={today} canPay={user.role === "ACCOUNTING"} /> : <PaidTable />}
    </>
  );
}

type PendingRow = Awaited<ReturnType<typeof db.request.findMany<{ include: { center: { select: { name: true; customerCode: true } } } }>>>[number];

function PendingTable({ rows, today, canPay }: { rows: PendingRow[]; today: string; canPay: boolean }) {
  return (
    <TableCard>
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>ครบกำหนด</th>
            <th className={thClass}>ศูนย์</th>
            <th className={thClass}>รอบบริการ</th>
            <th className={thClass}>เลขที่ใบแจ้งหนี้</th>
            <th className={`${thClass} text-right`}>ยอด (บาท)</th>
            <th className={thClass}>ใบแจ้งหนี้</th>
            <th className={thClass} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const due = toISODate(r.dueDate);
            return (
              <tr key={r.id} className={cx(rowClass, "align-top")}>
                <td className={`${tdClass} whitespace-nowrap`}>
                  <div className="flex flex-col items-start gap-1">
                    <span>{formatThaiDate(due)}</span>
                    <DueBadge daysLeft={daysUntil(today, due)} />
                  </div>
                </td>
                <td className={tdClass}>
                  <NameCell name={r.center.name} code={r.center.customerCode} href={`/requests/${r.id}`} />
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  {formatThaiDate(toISODate(r.periodStart))} – {formatThaiDate(toISODate(r.periodEnd))}
                </td>
                <td className={`${tdClass} tabular-nums`}>{r.invoiceNo}</td>
                <td className={`${tdClass} text-right font-semibold tabular-nums text-slate-900`}>{formatAmount(r.amount)}</td>
                <td className={tdClass}>
                  {r.invoiceFileKey ? (
                    <a
                      href={`/api/requests/${r.id}/invoice`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
                    >
                      <Paperclip className="size-3.5" aria-hidden /> เปิดไฟล์
                    </a>
                  ) : (
                    <span className="text-xs text-amber-700">ไม่มีไฟล์</span>
                  )}
                </td>
                <td className={`${tdClass} min-w-60`}>
                  {canPay ? (
                    <details className="group">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-800 group-open:bg-slate-100 group-open:text-slate-700 group-open:shadow-none">
                        <Banknote className="size-3.5" aria-hidden />
                        <span className="group-open:hidden">บันทึกการจ่าย</span>
                        <span className="hidden group-open:inline">ปิด</span>
                      </summary>
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <PayForm id={r.id} today={today} returnTo="list" />
                      </div>
                    </details>
                  ) : (
                    <span className="text-slate-300">–</span>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <EmptyRow colSpan={7} icon={Inbox}>
              ไม่มีใบเบิกที่รอจ่าย
            </EmptyRow>
          )}
        </tbody>
      </table>
    </TableCard>
  );
}

async function PaidTable() {
  const requests = await db.request.findMany({
    where: { status: "PAID", deletedAt: null },
    orderBy: [{ paidDate: "desc" }, { updatedAt: "desc" }],
    include: { center: { select: { name: true, customerCode: true } } },
    take: 100,
  });

  return (
    <TableCard>
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>วันที่จ่าย</th>
            <th className={thClass}>ศูนย์</th>
            <th className={thClass}>รอบบริการ</th>
            <th className={`${thClass} text-right`}>ยอด (บาท)</th>
            <th className={thClass}>เลขอ้างอิง</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className={rowClass}>
              <td className={`${tdClass} whitespace-nowrap`}>{r.paidDate && formatThaiDate(toISODate(r.paidDate))}</td>
              <td className={tdClass}>
                <NameCell name={r.center.name} code={r.center.customerCode} href={`/requests/${r.id}`} />
              </td>
              <td className={`${tdClass} whitespace-nowrap`}>
                {formatThaiDate(toISODate(r.periodStart))} – {formatThaiDate(toISODate(r.periodEnd))}
              </td>
              <td className={`${tdClass} text-right font-semibold tabular-nums text-slate-900`}>{formatAmount(r.amount)}</td>
              <td className={`${tdClass} tabular-nums`}>{r.paymentRef}</td>
            </tr>
          ))}
          {requests.length === 0 && (
            <EmptyRow colSpan={5} icon={Inbox}>
              ยังไม่มีใบเบิกที่จ่ายแล้ว
            </EmptyRow>
          )}
        </tbody>
      </table>
    </TableCard>
  );
}
