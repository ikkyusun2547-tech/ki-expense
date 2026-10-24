import { ArrowLeft, Banknote, Check, Clock, FileText, Paperclip, Pencil, Printer, Receipt, Send, Trash, Undo2 } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { LogAction, RequestStatus } from "@/generated/prisma/enums";
import { RequestStatusBadge } from "@/components/StatusBadge";
import { Alert, ButtonAnchor, ButtonLink, Card, CardTitle, cx, PageHeader, type IconType } from "@/components/ui";
import { formatAmount } from "@/lib/money";
import { ACTION_LABEL, canPerform, STATUS_LABEL } from "@/lib/status";
import { bahtText } from "@/lib/thai/bahtText";
import { daysInclusive, formatThaiDate, formatThaiDateTime, toISODate, todayISO } from "@/lib/thai/date";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { PayForm } from "../../accounting/PayForm";
import { StatusActions } from "./StatusActions";

const STEPS: RequestStatus[] = ["CREATED", "SENT", "PAID"];

const LOG_ICON: Record<LogAction, { icon: IconType; className: string }> = {
  CREATE: { icon: FileText, className: "bg-sky-100 text-sky-700" },
  EDIT: { icon: Pencil, className: "bg-slate-100 text-slate-600" },
  SEND: { icon: Send, className: "bg-amber-100 text-amber-700" },
  PAY: { icon: Banknote, className: "bg-emerald-100 text-emerald-700" },
  REVERT: { icon: Undo2, className: "bg-orange-100 text-orange-700" },
  DELETE: { icon: Trash, className: "bg-red-100 text-red-700" },
};

export default async function RequestDetailPage({ params }: PageProps<"/requests/[id]">) {
  // ทุกบทบาทดูรายละเอียดได้ (บัญชีเปิดจากหน้าฝ่ายบัญชี) — ปุ่มที่ทำได้ขึ้นกับ state machine
  const user = await requireUser();
  const backHref = user.role === "ACCOUNTING" ? "/accounting" : "/requests";

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
  const differsFromNormal = !request.amount.equals(request.center.normalAmount);

  return (
    <>
      <PageHeader
        icon={Receipt}
        title={`ใบเบิก ${request.center.name}`}
        description={`รอบบริการ ${formatThaiDate(periodStart)} – ${formatThaiDate(periodEnd)} · รหัสลูกค้า ${request.center.customerCode}`}
        actions={
          <ButtonLink href={backHref} variant="secondary" icon={ArrowLeft}>
            กลับ
          </ButtonLink>
        }
      />

      {deleted ? (
        <div className="mb-6">
          <Alert tone="error">ใบเบิกนี้ถูกลบแล้ว (เก็บไว้เป็นประวัติเท่านั้น)</Alert>
        </div>
      ) : (
        <Stepper status={request.status} />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card flush>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-sm text-slate-500">ยอดเบิก</div>
                <div className="text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                  {formatAmount(request.amount)} <span className="text-lg font-medium text-slate-500">บาท</span>
                </div>
                <div className="mt-0.5 text-sm text-slate-500">({bahtText(request.amount)})</div>
              </div>
              <RequestStatusBadge status={request.status} />
            </div>
            <dl className="grid gap-x-6 gap-y-4 px-6 py-5 text-sm sm:grid-cols-2">
              <Item label="ศูนย์">
                {request.center.name} <span className="text-slate-400">({request.center.customerCode})</span>
              </Item>
              <Item label="เลขที่ใบแจ้งหนี้">
                <span className="tabular-nums">{request.invoiceNo}</span>
              </Item>
              <Item label="รอบบริการ">
                {formatThaiDate(periodStart)} – {formatThaiDate(periodEnd)}{" "}
                <span className="text-slate-400">({daysInclusive(periodStart, periodEnd)} วัน)</span>
              </Item>
              <Item label="วันครบกำหนดชำระ">{formatThaiDate(toISODate(request.dueDate))}</Item>
              <Item label="ยอดปกติของศูนย์">
                {formatAmount(request.center.normalAmount)} บาท
                {differsFromNormal && <span className="ml-2 text-xs font-medium text-amber-700">ยอดเบิกไม่เท่ายอดปกติ</span>}
              </Item>
              <Item label="ใบแจ้งหนี้">
                {request.invoiceFileKey ? (
                  <a
                    href={`/api/requests/${request.id}/invoice`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
                  >
                    <Paperclip className="size-3.5" aria-hidden />
                    {request.invoiceFileName ?? "เปิดไฟล์"}
                  </a>
                ) : (
                  <span className="text-amber-700">ไม่ได้แนบไฟล์</span>
                )}
              </Item>
              <Item label="ผู้จัดทำ">{request.createdBy.name}</Item>
              {request.paidDate && <Item label="วันที่จ่าย">{formatThaiDate(toISODate(request.paidDate))}</Item>}
              {request.paymentRef && (
                <Item label="เลขอ้างอิงการจ่าย">
                  <span className="tabular-nums">{request.paymentRef}</span>
                </Item>
              )}
            </dl>
          </Card>

          <Card>
            <CardTitle icon={Clock}>ประวัติ</CardTitle>
            {request.logs.length === 0 ? (
              <p className="text-sm text-slate-400">ยังไม่มีประวัติ</p>
            ) : (
              <ol className="relative flex flex-col gap-5">
                <span className="absolute bottom-2 left-4 top-2 w-px bg-slate-200" aria-hidden />
                {request.logs.map((log) => {
                  const { icon: Icon, className } = LOG_ICON[log.action];
                  return (
                    <li key={log.id} className="relative flex gap-3">
                      <span className={cx("z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white", className)}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <div className="pt-1 text-sm">
                        <div className="font-medium text-slate-900">
                          {ACTION_LABEL[log.action]}
                          {log.fromStatus && log.toStatus && log.fromStatus !== log.toStatus && (
                            <span className="font-normal text-slate-500">
                              {" "}
                              · {STATUS_LABEL[log.fromStatus]} → {STATUS_LABEL[log.toStatus]}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500">
                          {log.actor.name} · {formatThaiDateTime(log.createdAt)}
                        </div>
                        {log.note && <div className="mt-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-slate-700">{log.note}</div>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        <div className="order-first flex flex-col gap-6 lg:order-none">
          <Card className="h-fit">
            <CardTitle>ดำเนินการ</CardTitle>
            <div className="flex flex-col gap-3">
              {!deleted && (
                <ButtonAnchor href={`/api/requests/${request.id}/pdf`} target="_blank" rel="noopener" icon={Printer}>
                  พิมพ์ใบเบิก (PDF)
                </ButtonAnchor>
              )}
              {can("EDIT") && (
                <ButtonLink href={`/requests/${request.id}/edit`} variant="secondary" icon={Pencil}>
                  แก้ไข
                </ButtonLink>
              )}
              <StatusActions id={request.id} canSend={can("SEND")} canDelete={can("DELETE")} canRevert={can("REVERT")} />
              {request.status === "PAID" && <p className="text-sm text-slate-500">ใบเบิกนี้จ่ายแล้ว ถูกล็อก แก้ไขไม่ได้</p>}
              {!deleted && request.status !== "CREATED" && user.role === "CREATOR" && (
                <p className="text-xs text-slate-500">
                  ใบเบิกที่{STATUS_LABEL[request.status]}แก้ไขไม่ได้ ถ้าต้องแก้ ติดต่อผู้ดูแลระบบให้ย้อนสถานะ
                </p>
              )}
            </div>
          </Card>

          {can("PAY") && (
            <Card>
              <CardTitle icon={Banknote}>บันทึกการจ่าย</CardTitle>
              <PayForm id={request.id} today={todayISO()} returnTo="detail" />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

// แถบขั้นตอน: สร้างแล้ว → ส่งบัญชีแล้ว → จ่ายแล้ว
function Stepper({ status }: { status: RequestStatus }) {
  const current = STEPS.indexOf(status);
  return (
    <ol className="mb-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      {STEPS.map((step, i) => {
        const done = i < current || status === "PAID";
        const active = i === current && status !== "PAID";
        return (
          <li key={step} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              className={cx(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                done && "bg-emerald-600 text-white",
                active && "bg-emerald-100 text-emerald-800 ring-2 ring-emerald-600",
                !done && !active && "bg-slate-100 text-slate-400",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={cx("whitespace-nowrap text-sm", done || active ? "font-medium text-slate-900" : "text-slate-400", !active && "hidden sm:inline")}>
              {STATUS_LABEL[step]}
            </span>
            {i < STEPS.length - 1 && <span className={cx("mx-2 h-px flex-1", i < current ? "bg-emerald-600" : "bg-slate-200")} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{children}</dd>
    </div>
  );
}
