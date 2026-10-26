import { ArrowLeft, Banknote, Check, CircleX, Clock, FileText, Paperclip, Pencil, Printer, Receipt, Send, Stamp, Trash, Undo2 } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { LogAction, RequestStatus } from "@/generated/prisma/enums";
import { RequestStatusBadge } from "@/components/StatusBadge";
import { Alert, ButtonAnchor, ButtonLink, Card, CardTitle, cx, PageHeader, type IconType } from "@/components/ui";
import { centerCode } from "@/lib/centers/phone";
import { formatAmount } from "@/lib/money";
import { chosenSignersOf, resolveSigners, type ResolvedSigner } from "@/lib/pdf/memoData";
import { ACTION_LABEL, canPerform, isAssignedApprover, returnedBy, STATUS_LABEL } from "@/lib/status";
import { bahtText } from "@/lib/thai/bahtText";
import { daysInclusive, formatThaiDate, formatThaiDateTime, toISODate, todayISO } from "@/lib/thai/date";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { PayForm } from "../../accounting/PayForm";
import { StatusActions } from "./StatusActions";

const STEPS: RequestStatus[] = ["CREATED", "PENDING", "APPROVED", "PAID"];

const LOG_ICON: Record<LogAction, { icon: IconType; className: string }> = {
  CREATE: { icon: FileText, className: "bg-sky-100 text-sky-700" },
  EDIT: { icon: Pencil, className: "bg-slate-100 text-slate-600" },
  SEND: { icon: Send, className: "bg-amber-100 text-amber-700" },
  SUBMIT: { icon: Send, className: "bg-amber-100 text-amber-700" },
  APPROVE: { icon: Stamp, className: "bg-emerald-100 text-emerald-700" },
  REJECT: { icon: CircleX, className: "bg-red-100 text-red-700" },
  PAY: { icon: Banknote, className: "bg-emerald-100 text-emerald-700" },
  REVERT: { icon: Undo2, className: "bg-orange-100 text-orange-700" },
  DELETE: { icon: Trash, className: "bg-red-100 text-red-700" },
};

export default async function RequestDetailPage({ params }: PageProps<"/requests/[id]">) {
  // ทุกบทบาทดูรายละเอียดได้ (บัญชีเปิดจากหน้าฝ่ายบัญชี) — ปุ่มที่ทำได้ขึ้นกับ state machine
  const user = await requireUser();
  const backHref = { ACCOUNTING: "/accounting", APPROVER: "/approvals", CREATOR: "/requests", ADMIN: "/requests" }[user.role];

  const { id } = await params;
  const request = await db.request.findUnique({
    where: { id },
    include: {
      center: true,
      createdBy: { select: { name: true, title: true } },
      logs: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!request) notFound();

  const periodStart = toISODate(request.periodStart);
  const periodEnd = toISODate(request.periodEnd);
  const deleted = !!request.deletedAt;
  const can = (action: Parameters<typeof canPerform>[1]) => !deleted && canPerform(user.role, action, request.status);
  const differsFromNormal = !request.amount.equals(request.center.normalAmount);

  // ผู้ลงนามที่จะพิมพ์ในใบเบิก: ที่เลือกไว้กับใบนี้ (บัญชีผู้ใช้) หรือค่าเริ่มต้น
  const signers = resolveSigners(chosenSignersOf(request), request.createdBy);
  const isMyApproval = !deleted && request.status === "PENDING" && isAssignedApprover(user.id, request);
  // ถูกตีกลับ → แสดงเหตุผลบนสุด (ไม่ต้องไล่หาในประวัติ)
  const returned = deleted ? null : returnedBy(request.status, request.logs);
  const phone = request.center.kind === "PHONE";

  return (
    <>
      <PageHeader
        icon={Receipt}
        title={`ใบเบิก ${request.center.name}`}
        description={`รอบบริการ ${formatThaiDate(periodStart)} – ${formatThaiDate(periodEnd)} · ${phone ? "เบอร์" : "รหัสลูกค้า"} ${centerCode(request.center)}`}
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

      {returned && (
        <div className="mb-6">
          <Alert tone="error">
            <p className="flex items-center gap-1.5 font-semibold">
              <CircleX className="size-4 shrink-0" aria-hidden />
              {returned.action === "REJECT" ? "ไม่อนุมัติ" : "ถูกย้อนสถานะ"} โดย {returned.actor.name} · {formatThaiDateTime(returned.createdAt)} น.
            </p>
            {returned.note && <p className="mt-1 pl-5.5 text-base">เหตุผล: {returned.note}</p>}
            {can("SUBMIT") && <p className="mt-1 pl-5.5 text-xs">แก้ไขตามเหตุผลแล้วกด “ส่งขออนุมัติ” อีกครั้ง</p>}
          </Alert>
        </div>
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
              <Item label={phone ? "เบอร์โทรศัพท์" : "ศูนย์"}>
                {phone ? (
                  <>
                    <span className="tabular-nums">{centerCode(request.center)}</span>{" "}
                    <span className="text-slate-400">
                      ({request.center.provider} · {request.center.name})
                    </span>
                  </>
                ) : (
                  <>
                    {request.center.name} <span className="text-slate-400">({request.center.customerCode})</span>
                  </>
                )}
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
              <Item label="ผู้จัดทำ">{request.createdBy.name}</Item>
              {!request.invoiceFileKey && (
                <Item label="ใบแจ้งหนี้">
                  <span className="text-amber-700">ไม่ได้แนบไฟล์</span>
                </Item>
              )}
              {request.paidDate && <Item label="วันที่จ่าย">{formatThaiDate(toISODate(request.paidDate))}</Item>}
              {request.paymentRef && (
                <Item label="เลขอ้างอิงการจ่าย">
                  <span className="tabular-nums">{request.paymentRef}</span>
                </Item>
              )}
            </dl>
            {/* ผู้ลงนาม (ที่พิมพ์ในใบเบิก) — แสดงอย่างเดียว เปลี่ยนได้ที่ "แก้ไข" */}
            <dl className="grid gap-x-6 gap-y-4 border-t border-slate-100 px-6 py-5 text-sm sm:grid-cols-2">
              <SignerItem label="ผู้ขออนุมัติ" signer={signers.requester} />
              <SignerItem label="ผู้อนุมัติ" signer={signers.approver}>
                {request.approvedAt && (
                  <div className="text-xs font-medium text-emerald-700">อนุมัติแล้ว {formatThaiDateTime(request.approvedAt)} น.</div>
                )}
              </SignerItem>
            </dl>
          </Card>

          {request.invoiceFileKey && <InvoicePreview id={request.id} fileKey={request.invoiceFileKey} fileName={request.invoiceFileName} />}

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
              <StatusActions
                id={request.id}
                canSubmit={can("SUBMIT")}
                submitBlocked={request.approverId ? undefined : "ยังไม่ได้เลือกผู้อนุมัติ — กด “แก้ไข” เพื่อเลือก"}
                approverName={request.approverName}
                canApprove={isMyApproval}
                canDelete={can("DELETE")}
                canRevert={can("REVERT")}
              />
              {!deleted && request.status === "PENDING" && !isMyApproval && (
                <p className="text-sm text-slate-500">รอ {request.approverName} อนุมัติ</p>
              )}
              {request.status === "PAID" && <p className="text-sm text-slate-500">ใบเบิกนี้จ่ายแล้ว ถูกล็อก แก้ไขไม่ได้</p>}
              {!deleted && request.status !== "CREATED" && user.role === "CREATOR" && (
                <p className="text-xs text-slate-500">
                  ใบเบิกที่{STATUS_LABEL[request.status]}แก้ไขไม่ได้ ถ้าต้องแก้ ให้ผู้อนุมัติกด “ไม่อนุมัติ” หรือติดต่อผู้ดูแลระบบให้ย้อนสถานะ
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

// ดูใบแจ้งหนี้ในหน้าเลย (ผู้อนุมัติ/บัญชีไม่ต้องเปิดแท็บใหม่) — ไฟล์มาจาก route ที่ตรวจสิทธิ์แล้ว
// PDF ใช้ตัวแสดงผลของเบราว์เซอร์ (มือถือบางรุ่นแสดงไม่ได้ จึงมีลิงก์เปิดแท็บใหม่ไว้เสมอ)
function InvoicePreview({ id, fileKey, fileName }: { id: string; fileKey: string; fileName: string | null }) {
  const src = `/api/requests/${id}/invoice`;
  const isPdf = fileKey.endsWith(".pdf");
  return (
    <Card flush>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold text-slate-900">
          <Paperclip className="size-4 shrink-0 text-slate-400" aria-hidden />
          <span className="truncate">ใบแจ้งหนี้{fileName && <span className="font-normal text-slate-500"> · {fileName}</span>}</span>
        </h2>
        <a href={src} target="_blank" rel="noopener" className="shrink-0 text-sm font-medium text-emerald-700 hover:underline">
          เปิดในแท็บใหม่
        </a>
      </div>
      {isPdf ? (
        <iframe src={`${src}#view=FitH`} title="ใบแจ้งหนี้" className="h-[70vh] min-h-96 w-full rounded-b-xl bg-slate-100" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- ไฟล์จาก API ที่ต้องล็อกอิน ไม่ผ่าน next/image
        <img src={src} alt={`ใบแจ้งหนี้ ${fileName ?? ""}`} className="mx-auto max-h-[70vh] w-auto rounded-b-xl p-4" />
      )}
    </Card>
  );
}

// แถบขั้นตอน: สร้างแล้ว → รออนุมัติ → อนุมัติแล้ว → จ่ายแล้ว
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

function SignerItem({ label, signer, children }: { label: string; signer: ResolvedSigner; children?: ReactNode }) {
  return (
    <Item label={label}>
      {signer.name || <span className="text-amber-700">ยังไม่เลือก</span>}
      {signer.title && <div className="text-xs text-slate-500">{signer.title}</div>}
      {children}
    </Item>
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
