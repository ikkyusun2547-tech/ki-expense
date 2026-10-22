import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { RequestStatusBadge } from "@/components/StatusBadge";
import { Alert, ButtonLink, Card, PageHeader } from "@/components/ui";
import { formatAmount } from "@/lib/money";
import { ACTION_LABEL, canPerform, STATUS_LABEL } from "@/lib/status";
import { daysInclusive, formatThaiDate, formatThaiDateTime, toISODate } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { StatusActions } from "./StatusActions";

export default async function RequestDetailPage({ params }: PageProps<"/requests/[id]">) {
  const user = await requireRole("CREATOR", "ADMIN");

  const { id } = await params;
  const request = await db.request.findUnique({
    where: { id },
    include: {
      center: true,
      createdBy: { select: { name: true } },
      logs: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!request) notFound();

  const periodStart = toISODate(request.periodStart);
  const periodEnd = toISODate(request.periodEnd);
  const deleted = !!request.deletedAt;
  const can = (action: Parameters<typeof canPerform>[1]) => !deleted && canPerform(user.role, action, request.status);

  return (
    <>
      <PageHeader
        title={`ใบเบิก ${request.center.name}`}
        description={`รอบบริการ ${formatThaiDate(periodStart)} – ${formatThaiDate(periodEnd)}`}
        actions={
          <ButtonLink href="/requests" variant="secondary">
            ← รายการใบเบิก
          </ButtonLink>
        }
      />

      {deleted && (
        <div className="mb-4">
          <Alert tone="error">ใบเบิกนี้ถูกลบแล้ว (เก็บไว้เป็นประวัติเท่านั้น)</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Item label="สถานะ">
                <RequestStatusBadge status={request.status} />
              </Item>
              <Item label="ศูนย์">
                {request.center.name} <span className="font-mono text-zinc-500">({request.center.customerCode})</span>
              </Item>
              <Item label="เลขที่ใบแจ้งหนี้">
                <span className="font-mono">{request.invoiceNo}</span>
              </Item>
              <Item label="ยอด">
                <span className="tabular-nums">{formatAmount(request.amount)}</span> บาท
                {!request.amount.equals(request.center.normalAmount) && (
                  <span className="ml-2 text-amber-700">(ยอดปกติ {formatAmount(request.center.normalAmount)})</span>
                )}
              </Item>
              <Item label="รอบบริการ">
                {formatThaiDate(periodStart)} – {formatThaiDate(periodEnd)}{" "}
                <span className="text-zinc-500">({daysInclusive(periodStart, periodEnd)} วัน)</span>
              </Item>
              <Item label="วันครบกำหนดชำระ">{formatThaiDate(toISODate(request.dueDate))}</Item>
              <Item label="ใบแจ้งหนี้">
                {request.invoiceFileKey ? (
                  <a href={`/api/requests/${request.id}/invoice`} target="_blank" rel="noopener" className="text-emerald-700 hover:underline">
                    {request.invoiceFileName ?? "เปิดไฟล์"} ↗
                  </a>
                ) : (
                  <span className="text-amber-700">ไม่ได้แนบไฟล์</span>
                )}
              </Item>
              <Item label="ผู้จัดทำ">{request.createdBy.name}</Item>
              {request.paidDate && <Item label="วันที่จ่าย">{formatThaiDate(toISODate(request.paidDate))}</Item>}
              {request.paymentRef && <Item label="เลขอ้างอิงการจ่าย">{request.paymentRef}</Item>}
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 font-medium text-zinc-900">ประวัติ</h2>
            <ol className="flex flex-col gap-3 text-sm">
              {request.logs.map((log) => (
                <li key={log.id} className="border-l-2 border-zinc-200 pl-3">
                  <div>
                    <span className="font-medium">{ACTION_LABEL[log.action]}</span>
                    {log.fromStatus && log.toStatus && log.fromStatus !== log.toStatus && (
                      <span className="text-zinc-500">
                        {" "}
                        ({STATUS_LABEL[log.fromStatus]} → {STATUS_LABEL[log.toStatus]})
                      </span>
                    )}
                  </div>
                  <div className="text-zinc-500">
                    {log.actor.name} · {formatThaiDateTime(log.createdAt)}
                  </div>
                  {log.note && <div className="mt-1 text-zinc-700">หมายเหตุ: {log.note}</div>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Card className="h-fit">
          <h2 className="mb-3 font-medium text-zinc-900">ดำเนินการ</h2>
          <div className="flex flex-col gap-3">
            {/* TODO(เฟส 4): ปุ่มพิมพ์ใบเบิก PDF */}
            <p className="text-sm text-zinc-500">พิมพ์ใบเบิก (PDF) — จะเพิ่มในเฟส 4</p>
            {can("EDIT") && (
              <ButtonLink href={`/requests/${request.id}/edit`} variant="secondary">
                แก้ไข
              </ButtonLink>
            )}
            <StatusActions id={request.id} canSend={can("SEND")} canDelete={can("DELETE")} canRevert={can("REVERT")} />
            {!deleted && request.status !== "CREATED" && user.role === "CREATOR" && (
              <p className="text-xs text-zinc-500">
                ใบเบิกที่{STATUS_LABEL[request.status]}แก้ไขไม่ได้ ถ้าต้องแก้ ติดต่อผู้ดูแลระบบให้ย้อนสถานะ
              </p>
            )}
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            <Link href="/requests" className="hover:underline">
              กลับไปรายการ
            </Link>
          </p>
        </Card>
      </div>
    </>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-zinc-900">{children}</dd>
    </div>
  );
}
