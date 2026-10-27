import { ArrowLeft, ArrowRightLeft, Banknote, Check, CircleX, Clock, ExternalLink, FileText, Paperclip, Pencil, Printer, Receipt, Send, Stamp, Trash, Undo2 } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { LogAction, RequestStatus } from "@/generated/prisma/enums";
import { RequestStatusBadge } from "@/components/StatusBadge";
import { PhoneChargesTable } from "@/components/PhoneCharges";
import { TransferForm } from "@/components/TransferForm";
import { Alert, ButtonAnchor, ButtonLink, Card, CardTitle, cx, PageHeader, type IconType } from "@/components/ui";
import { kindHref } from "@/lib/auth/routes";
import { centerCode } from "@/lib/centers/phone";
import { formatAmount } from "@/lib/money";
import { chosenSignersOf, resolveSigners, type ResolvedSigner } from "@/lib/pdf/memoData";
import { storedCharges } from "@/lib/rules/phoneCharges";
import { ACTION_LABEL, checkRequestAction, isAssignedApprover, returnedBy, STATUS_LABEL, type RequestAction } from "@/lib/status";
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
  TRANSFER: { icon: ArrowRightLeft, className: "bg-slate-100 text-slate-600" },
};

export default async function RequestDetailPage({ params, searchParams }: PageProps<"/requests/[id]">) {
  // ทุกบทบาทดูรายละเอียดได้ (บัญชีเปิดจากหน้าฝ่ายบัญชี) — ปุ่มที่ทำได้ขึ้นกับ state machine
  const user = await requireUser();

  const { id } = await params;
  const request = await db.request.findUnique({
    where: { id },
    include: {
      center: true,
      createdBy: { select: { id: true, name: true, title: true } },
      logs: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!request) notFound();

  const periodStart = toISODate(request.periodStart);
  const periodEnd = toISODate(request.periodEnd);
  const deleted = !!request.deletedAt;
  // แก้/ลบ/ส่งได้เฉพาะเจ้าของใบ (checkRequestAction)
  const can = (action: RequestAction) => !deleted && checkRequestAction(user, action, request).ok;
  const othersDraft = !deleted && request.status === "CREATED" && user.role === "CREATOR" && request.createdById !== user.id;
  const transferred = (await searchParams).transferred === "1";
  // admin โอนใบให้ผู้จัดทำคนอื่น (เจ้าของลา/ลาออก)
  const creators = can("TRANSFER")
    ? await db.user.findMany({
        where: { role: "CREATOR", active: true, id: { not: request.createdById } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];
  const differsFromNormal = !request.amount.equals(request.center.normalAmount);

  // ผู้ลงนามที่จะพิมพ์ในใบเบิก: ที่เลือกไว้กับใบนี้ (บัญชีผู้ใช้) หรือค่าเริ่มต้น
  const signers = resolveSigners(chosenSignersOf(request), request.createdBy);
  const isMyApproval = !deleted && request.status === "PENDING" && isAssignedApprover(user.id, request);
  // ถูกตีกลับ → แสดงเหตุผลบนสุด (ไม่ต้องไล่หาในประวัติ)
  const returned = deleted ? null : returnedBy(request.status, request.logs);
  const phone = request.center.kind === "PHONE";
  const hasCharges = storedCharges(request) !== null;
  const list = kindHref("/requests", request.center.kind);
  const backHref = { ACCOUNTING: "/accounting", APPROVER: "/approvals", CREATOR: list, ADMIN: list }[user.role];

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

      {transferred && (
        <div className="mb-6">
          <Alert tone="success">โอนใบเบิกให้ {request.createdBy.name} แล้ว</Alert>
        </div>
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
            {/* ข้อมูลใบเบิก / ยอดแยก (ค่าโทรศัพท์) / ผู้ลงนาม — ตารางหัวข้อซ้าย-ค่าขวา อ่านไล่ลงมาทีละแถว */}
            <div className="flex flex-col gap-5 px-6 py-5">
              <InfoTable title="ข้อมูลใบเบิก">
                <Item label={phone ? "เบอร์โทรศัพท์" : "ศูนย์"}>
                  {phone ? <span className="tabular-nums">{centerCode(request.center)}</span> : request.center.name}
                  <Muted>
                    {" "}
                    · {request.center.provider} · {phone ? request.center.name : request.center.customerCode}
                  </Muted>
                </Item>
                <Item label="เลขที่ใบแจ้งหนี้">
                  <span className="break-all tabular-nums">{request.invoiceNo}</span>
                </Item>
                <Item label="รอบบริการ">
                  {formatThaiDate(periodStart)} – {formatThaiDate(periodEnd)}
                  <Muted> ({daysInclusive(periodStart, periodEnd)} วัน)</Muted>
                </Item>
                <Item label="ครบกำหนดชำระ">{formatThaiDate(toISODate(request.dueDate))}</Item>
                <Item label={phone ? "ยอดปกติของเบอร์" : "ยอดปกติของศูนย์"}>
                  <span className="tabular-nums">{formatAmount(request.center.normalAmount)}</span> บาท
                  {differsFromNormal && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">ยอดเบิกไม่เท่ายอดปกติ</span>
                  )}
                </Item>
                <Item label="ใบแจ้งหนี้">
                  {request.invoiceFileKey ? (
                    <a
                      href={`/api/requests/${request.id}/invoice`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
                    >
                      <Paperclip className="size-3.5" aria-hidden /> แนบแล้ว (เปิดดู)
                    </a>
                  ) : (
                    <span className="font-medium text-amber-700">ไม่ได้แนบไฟล์</span>
                  )}
                </Item>
                {request.paidDate && <Item label="วันที่จ่าย">{formatThaiDate(toISODate(request.paidDate))}</Item>}
                {request.paymentRef && (
                  <Item label="เลขอ้างอิงการจ่าย">
                    <span className="tabular-nums">{request.paymentRef}</span>
                  </Item>
                )}
              </InfoTable>

              {/* ค่าโทรศัพท์: ยอดแยกแบบในบิล ให้ผู้ดู/ผู้อนุมัติเห็นชัด (ไม่พิมพ์ใน PDF) */}
              {hasCharges && <PhoneChargesTable request={request} />}

              {/* ผู้ลงนามที่พิมพ์ในใบเบิก — แสดงอย่างเดียว เปลี่ยนได้ที่ "แก้ไข" */}
              <InfoTable title="ผู้ลงนาม">
                <Item label="ผู้จัดทำ">{request.createdBy.name}</Item>
                <SignerItem label="ผู้ขออนุมัติ" signer={signers.requester} />
                <SignerItem label="ผู้อนุมัติ" signer={signers.approver}>
                  {request.approvedAt && (
                    <div className="text-xs font-medium text-emerald-700">อนุมัติแล้ว {formatThaiDateTime(request.approvedAt)} น.</div>
                  )}
                </SignerItem>
              </InfoTable>
            </div>
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
              {othersDraft && (
                <p className="text-xs text-slate-500">
                  ใบเบิกนี้เป็นของ {request.createdBy.name} — แก้ไข/ลบ/ส่งขออนุมัติได้เฉพาะผู้สร้างใบ ถ้า {request.createdBy.name} ไม่อยู่
                  ให้ผู้ดูแลระบบโอนใบให้
                </p>
              )}
              {!deleted && request.status !== "CREATED" && user.role === "CREATOR" && (
                <p className="text-xs text-slate-500">
                  ใบเบิกที่{STATUS_LABEL[request.status]}แก้ไขไม่ได้ ถ้าต้องแก้ ให้ผู้อนุมัติกด “ไม่อนุมัติ” หรือติดต่อผู้ดูแลระบบให้ย้อนสถานะ
                </p>
              )}
            </div>
          </Card>

          {can("TRANSFER") && (
            <Card>
              <CardTitle icon={ArrowRightLeft}>โอนใบเบิก</CardTitle>
              <p className="mb-3 text-sm text-slate-600">
                ตอนนี้เป็นของ {request.createdBy.name} — ผู้รับโอนจะแก้ไข/ลบ/ส่งขออนุมัติได้แทน
              </p>
              <TransferForm
                target={{ requestId: request.id }}
                creators={creators}
                confirmText={`โอนใบเบิกนี้จาก ${request.createdBy.name} ให้ผู้จัดทำที่เลือก?`}
              />
            </Card>
          )}

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
        <ButtonAnchor href={src} target="_blank" rel="noopener" variant="secondary" size="sm" icon={ExternalLink} className="shrink-0">
          เปิดในแท็บใหม่
        </ButtonAnchor>
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
                done && "bg-brand-600 text-white",
                active && "bg-brand-100 text-brand-800 ring-2 ring-brand-600",
                !done && !active && "bg-slate-100 text-slate-400",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={cx("whitespace-nowrap text-sm", done || active ? "font-medium text-slate-900" : "text-slate-400", !active && "hidden sm:inline")}>
              {STATUS_LABEL[step]}
            </span>
            {i < STEPS.length - 1 && <span className={cx("mx-2 h-px flex-1", i < current ? "bg-brand-600" : "bg-slate-200")} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function SignerItem({ label, signer, children }: { label: string; signer: ResolvedSigner; children?: ReactNode }) {
  return (
    <Item label={label}>
      {signer.name || <span className="font-medium text-amber-700">ยังไม่เลือก</span>}
      {signer.title && <Muted> · {signer.title}</Muted>}
      {children}
    </Item>
  );
}

// ตารางหัวข้อ-ค่า แบบเดียวกับตารางยอดแยกค่าโทรศัพท์ (PhoneChargesTable)
function InfoTable({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      <dl className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 text-sm">{children}</dl>
    </section>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-2">
      <dt className="w-28 shrink-0 text-slate-500 sm:w-36">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-900">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-slate-500">{children}</span>;
}
