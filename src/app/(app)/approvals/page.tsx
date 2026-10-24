import { CircleCheck, Clock, Inbox, Paperclip, Stamp } from "lucide-react";
import Link from "next/link";
import { DueBadge } from "@/components/DueBadge";
import { RequestStatusBadge } from "@/components/StatusBadge";
import { Alert, cx, EmptyRow, NameCell, PageHeader, RowLink, rowClass, TableCard, tableClass, tdClass, thClass } from "@/components/ui";
import { formatAmount } from "@/lib/money";
import { daysUntil } from "@/lib/rules/centerSummary";
import { formatThaiDate, formatThaiDateTime, toISODate, todayISO } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { BulkCheckbox } from "@/components/BulkBar";
import { ApproveButton } from "./ApproveButton";
import { BulkApprove } from "./BulkApprove";

const BULK_FORM = "bulk-approve";

const TABS = [
  { key: "pending", label: "รออนุมัติ", icon: Clock, href: "/approvals" },
  {
    key: "done",
    label: "อนุมัติแล้ว",
    icon: CircleCheck,
    href: "/approvals?tab=done",
  },
] as const;

const DONE_MESSAGE: Record<string, string> = {
  approve: "อนุมัติแล้ว{n} ใบเบิกส่งต่อให้ฝ่ายบัญชีเรียบร้อย",
  reject: "ไม่อนุมัติแล้ว ใบเบิกกลับไปให้ผู้จัดทำแก้ไข",
};

const INCLUDE = {
  center: { select: { name: true, customerCode: true } },
  createdBy: { select: { name: true } },
} as const;

// ผู้อนุมัติเห็นเฉพาะใบที่ผู้จัดทำเลือกตนเป็นผู้อนุมัติ; admin เห็นทุกใบ (ดูอย่างเดียว อนุมัติแทนไม่ได้)
export default async function ApprovalsPage({ searchParams }: PageProps<"/approvals">) {
  const user = await requireRole("APPROVER", "ADMIN");
  const isApprover = user.role === "APPROVER";
  const mine = isApprover ? { approverId: user.id } : {};
  const today = todayISO();

  const params = await searchParams;
  const tab = params.tab === "done" ? "done" : "pending";
  // อนุมัติทีละหลายใบ: n = จำนวนที่สำเร็จ, fail = จำนวนที่ไม่สำเร็จ (สถานะเปลี่ยนไประหว่างนั้น)
  const n = Number(params.n) || 0;
  const fail = Number(params.fail) || 0;
  const done = typeof params.done === "string" ? DONE_MESSAGE[params.done]?.replace("{n}", n > 1 ? ` ${n} ใบ` : "") : undefined;

  const pending = await db.request.findMany({
    where: { status: "PENDING", deletedAt: null, ...mine },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    include: INCLUDE,
  });

  return (
    <>
      <PageHeader
        icon={Stamp}
        title="รออนุมัติ"
        description={
          isApprover
            ? "ใบเบิกที่ส่งมาให้คุณ — ใกล้ครบกำหนดอยู่บนสุด"
            : "ใบที่รออนุมัติทั้งหมด (ดูอย่างเดียว)"
        }
      />

      {(done || fail > 0) && (
        <div className="mb-4 flex flex-col gap-2">
          {done && (params.n === undefined || n > 0) && <Alert tone="success">{done}</Alert>}
          {fail > 0 && <Alert tone="warning">อีก {fail} ใบอนุมัติไม่ได้ (สถานะเปลี่ยนไปแล้ว) — ตรวจรายการอีกครั้ง</Alert>}
        </div>
      )}

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

      {tab === "pending" ? (
        <>
          {/* จอเล็ก (มือถือ): การ์ดทีละใบ กดอนุมัติได้เลย — จอใหญ่: ตาราง */}
          {isApprover && pending.length > 1 && <BulkApprove formId={BULK_FORM} />}
          <PendingCards rows={pending} today={today} isApprover={isApprover} />
          <div className="hidden md:block">
            <TableCard>
              <table className={tableClass}>
                <thead>
                  <tr>
                    {isApprover && <th className={`${thClass} w-10`} />}
                    <th className={thClass}>ครบกำหนด</th>
                    <th className={thClass}>ศูนย์</th>
                    <th className={thClass}>รอบบริการ</th>
                    <th className={`${thClass} text-right`}>ยอด (บาท)</th>
                    <th className={thClass}>ผู้ขออนุมัติ</th>
                    {!isApprover && <th className={thClass}>ผู้อนุมัติ</th>}
                    <th className={thClass}>ใบแจ้งหนี้</th>
                    <th className={thClass} />
                  </tr>
                </thead>
                <tbody>
                  {pending.map((r) => {
                    const due = toISODate(r.dueDate);
                    return (
                      <tr key={r.id} className={cx(rowClass, "align-top")}>
                        {isApprover && (
                          <td className={tdClass}>
                            <BulkCheckbox formId={BULK_FORM} id={r.id} label={`เลือก ${r.center.name}`} />
                          </td>
                        )}
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
                        <td className={`${tdClass} text-right font-semibold tabular-nums text-slate-900`}>{formatAmount(r.amount)}</td>
                        <td className={tdClass}>{r.requesterName ?? r.createdBy.name}</td>
                        {!isApprover && <td className={tdClass}>{r.approverName}</td>}
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
                        <td className={`${tdClass} text-right`}>
                          <div className="flex items-start justify-end gap-1">
                            <RowLink href={`/requests/${r.id}`}>{isApprover ? "ดู / ไม่อนุมัติ" : "ดู"}</RowLink>
                            {isApprover && <ApproveButton id={r.id} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pending.length === 0 && (
                    <EmptyRow colSpan={8} icon={Inbox}>
                      ไม่มีใบเบิกที่รออนุมัติ
                    </EmptyRow>
                  )}
                </tbody>
              </table>
            </TableCard>
          </div>
        </>
      ) : (
        <DoneTable where={mine} showApprover={!isApprover} />
      )}
    </>
  );
}

type PendingRow = Awaited<ReturnType<typeof db.request.findMany<{ include: typeof INCLUDE }>>>[number];

function PendingCards({ rows, today, isApprover }: { rows: PendingRow[]; today: string; isApprover: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm md:hidden">
        <Inbox className="mx-auto mb-3 size-10 text-slate-300" aria-hidden />
        ไม่มีใบเบิกที่รออนุมัติ
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {rows.map((r) => {
        const due = toISODate(r.dueDate);
        return (
          <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {isApprover && (
                  <span className="pt-1">
                    <BulkCheckbox formId={BULK_FORM} id={r.id} label={`เลือก ${r.center.name}`} />
                  </span>
                )}
                <NameCell name={r.center.name} code={r.center.customerCode} href={`/requests/${r.id}`} />
              </div>
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums text-slate-900">{formatAmount(r.amount)}</div>
                <div className="text-xs text-slate-500">บาท</div>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">ครบกำหนด</dt>
                <dd className="flex flex-wrap items-center gap-1">
                  {formatThaiDate(due)} <DueBadge daysLeft={daysUntil(today, due)} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">รอบบริการ</dt>
                <dd>
                  {formatThaiDate(toISODate(r.periodStart))} – {formatThaiDate(toISODate(r.periodEnd))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">ผู้ขออนุมัติ</dt>
                <dd>{r.requesterName ?? r.createdBy.name}</dd>
              </div>
              {!isApprover && (
                <div>
                  <dt className="text-xs text-slate-500">ผู้อนุมัติ</dt>
                  <dd>{r.approverName}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
              {r.invoiceFileKey ? (
                <a
                  href={`/api/requests/${r.id}/invoice`}
                  target="_blank"
                  rel="noopener"
                  className="mr-auto inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
                >
                  <Paperclip className="size-3.5" aria-hidden /> เปิดไฟล์
                </a>
              ) : (
                <span className="mr-auto text-xs text-amber-700">ไม่มีไฟล์</span>
              )}
              <RowLink href={`/requests/${r.id}`}>{isApprover ? "ดู / ไม่อนุมัติ" : "ดู"}</RowLink>
              {isApprover && <ApproveButton id={r.id} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ใบที่อนุมัติแล้ว (รอจ่าย/จ่ายแล้ว) ล่าสุด 100 ใบ
async function DoneTable({ where, showApprover }: { where: { approverId?: string }; showApprover: boolean }) {
  const requests = await db.request.findMany({
    where: {
      status: { in: ["APPROVED", "PAID"] },
      approvedAt: { not: null },
      deletedAt: null,
      ...where,
    },
    orderBy: { approvedAt: "desc" },
    include: INCLUDE,
    take: 100,
  });

  return (
    <TableCard>
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>อนุมัติเมื่อ</th>
            <th className={thClass}>ศูนย์</th>
            <th className={`${thClass} text-right`}>ยอด (บาท)</th>
            <th className={thClass}>ผู้ขออนุมัติ</th>
            {showApprover && <th className={thClass}>ผู้อนุมัติ</th>}
            <th className={thClass}>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className={rowClass}>
              <td className={`${tdClass} whitespace-nowrap`}>{r.approvedAt && formatThaiDateTime(r.approvedAt)}</td>
              <td className={tdClass}>
                <NameCell name={r.center.name} code={r.center.customerCode} href={`/requests/${r.id}`} />
              </td>
              <td className={`${tdClass} text-right font-semibold tabular-nums text-slate-900`}>{formatAmount(r.amount)}</td>
              <td className={tdClass}>{r.requesterName ?? r.createdBy.name}</td>
              {showApprover && <td className={tdClass}>{r.approverName}</td>}
              <td className={tdClass}>
                <RequestStatusBadge status={r.status} />
              </td>
            </tr>
          ))}
          {requests.length === 0 && (
            <EmptyRow colSpan={showApprover ? 6 : 5} icon={Inbox}>
              ยังไม่มีใบเบิกที่อนุมัติแล้ว
            </EmptyRow>
          )}
        </tbody>
      </table>
    </TableCard>
  );
}
