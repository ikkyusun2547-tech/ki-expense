import { CircleCheck, Eye, FilePlus, FileText, Hourglass, Inbox, Layers, Plus, Receipt, Search, Send, Smartphone, Wifi, X } from "lucide-react";
import { Fragment } from "react";
import type { RequestStatus, ServiceKind } from "@/generated/prisma/enums";
import { REQUEST_TONE, RequestStatusBadge } from "@/components/StatusBadge";
import { ClickableRow } from "@/components/ClickableRow";
import { AmountCell, COLUMN, InvoiceCell, PeriodDueCell, ServiceCell } from "@/components/RequestCells";
import {
  Badge,
  Button,
  cx,
  ButtonLink,
  EmptyRow,
  FilterBar,
  FilterSelect,
  PageHeader,
  PillTabs,
  RowLink,
  SearchInput,
  StatCard,
  TableCard,
  tableClass,
  tdClass,
  thClass,
  TONE_SURFACE,
  type BadgeTone,
  type IconType,
} from "@/components/ui";
import { kindHref } from "@/lib/auth/routes";
import { canCreateRequest, returnedBy, SERVICE_KIND_LABEL, STATUS_LABEL } from "@/lib/status";
import { formatThaiDate, todayISO } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";

const STATUSES = Object.keys(STATUS_LABEL) as RequestStatus[];
const KINDS = Object.keys(SERVICE_KIND_LABEL) as ServiceKind[];

const STATUS_CARD: Record<RequestStatus, { icon: IconType; tone: BadgeTone; sub: string }> = {
  CREATED: { icon: FileText, tone: "zinc", sub: "รอส่งขออนุมัติ" },
  PENDING: { icon: Hourglass, tone: "amber", sub: "รอผู้อนุมัติ" },
  APPROVED: { icon: Send, tone: "sky", sub: "รอบัญชีรับเอกสาร" },
  RECEIVED: { icon: Inbox, tone: "violet", sub: "รอฝ่ายบัญชีจ่าย" },
  PAID: { icon: CircleCheck, tone: "green", sub: "เสร็จสิ้น" },
};

// พื้นหัวกลุ่ม = สีของสถานะ; สถานะเทา (สร้างแล้ว) ใช้พื้นเทาอ่อนแทนขาว ไม่ให้กลืนกับแถวข้อมูล
const groupSurface = (s: RequestStatus) =>
  REQUEST_TONE[s] === "zinc" ? "border-slate-200 border-l-slate-500 bg-slate-100" : TONE_SURFACE[REQUEST_TONE[s]];

export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const user = await requireRole("CREATOR", "ADMIN");

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = STATUSES.find((s) => s === params.status);
  const kind = KINDS.find((k) => k === params.kind);
  // ดูย้อนหลังรายเดือนอยู่หน้า /history (ประวัติ) — หน้านี้ไว้ทำงานประจำวัน
  const base = { deletedAt: null, ...(kind && { center: { kind } }) };

  const [requests, counts] = await Promise.all([
    db.request.findMany({
      where: {
        ...base,
        ...(status && { status }),
        ...(q && {
          OR: [
            { invoiceNo: { contains: q, mode: "insensitive" } },
            { center: { customerCode: { contains: q, mode: "insensitive" } } },
            { center: { customerCode: { contains: q.replace(/[\s-]/g, "") || q } } }, // เบอร์โทรที่พิมพ์มีขีด
            { center: { name: { contains: q, mode: "insensitive" } } },
          ],
        }),
      },
      // จัดกลุ่มตามขั้นตอน (ลำดับ enum: สร้างแล้ว → รออนุมัติ → อนุมัติแล้ว → บัญชีรับแล้ว → จ่ายแล้ว) งานค้างอยู่บน
      // ในกลุ่มเรียงวันที่สร้างใหม่สุดก่อน (ผู้ใช้บอก 2026-10-31 ว่าเรียงตามรอบบริการแล้ว "ดูสะเปะสะปะ")
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        center: { select: { kind: true, name: true, customerCode: true } },
        createdBy: { select: { name: true } },
        // การกระทำล่าสุดในเส้นทางอนุมัติ — ไว้บอกว่าใบ "สร้างแล้ว" ใบไหนถูกตีกลับ
        logs: {
          where: { action: { in: ["SUBMIT", "APPROVE", "REJECT", "REVERT"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { action: true },
        },
      },
      take: 200,
    }),
    db.request.groupBy({ by: ["status"], where: base, _count: true }),
  ]);
  const countOf = (s: RequestStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const filterHref = (s: RequestStatus) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(kind && { kind }), ...(status !== s && { status: s }) });
    return p.size ? `/requests?${p}` : "/requests";
  };

  return (
    <>
      <PageHeader
        icon={Receipt}
        title={kind ? `ใบเบิกค่า${SERVICE_KIND_LABEL[kind]}` : "ใบเบิก"}
        description={`${kind === "PHONE" ? "ทุกเบอร์" : kind ? "ทุกศูนย์" : "ทุกศูนย์และทุกเบอร์"} (ล่าสุด 200 ใบ) · เรียงตามขั้นตอน งานค้างอยู่บนสุด · ดูย้อนหลังรายเดือนที่เมนูประวัติ`}
        actions={
          canCreateRequest(user.role) && (
            // เลือกศูนย์/เบอร์จากการ์ดในหน้าสรุป แล้วกรอกใบแจ้งหนี้
            <ButtonLink href={kindHref("/summary", kind ?? "INTERNET")} icon={Plus}>
              สร้างใบเบิก
            </ButtonLink>
          )
        }
      />

      <PillTabs
        label="ประเภทค่าบริการ"
        tabs={[
          { href: "/requests", label: "ทั้งหมด", icon: Layers, active: !kind },
          { href: kindHref("/requests", "INTERNET"), label: "ค่าอินเทอร์เน็ต", icon: Wifi, active: kind === "INTERNET" },
          { href: kindHref("/requests", "PHONE"), label: "ค่าโทรศัพท์", icon: Smartphone, active: kind === "PHONE" },
        ]}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {STATUSES.map((s) => (
          <StatCard
            key={s}
            label={STATUS_LABEL[s]}
            value={countOf(s)}
            sub={STATUS_CARD[s].sub}
            icon={STATUS_CARD[s].icon}
            tone={STATUS_CARD[s].tone}
            href={filterHref(s)}
            active={status === s}
          />
        ))}
      </div>

      <FilterBar>
        {/* ประเภทเลือกจากเมนู — คงไว้ตอนค้นหา */}
        {kind && <input type="hidden" name="kind" value={kind} />}
        <SearchInput
          defaultValue={q}
          placeholder={kind === "PHONE" ? "ค้นหาเบอร์ / ผู้ใช้บริการ / เลขที่ใบแจ้งหนี้" : "ค้นหาศูนย์ / รหัสลูกค้า / เลขที่ใบแจ้งหนี้"}
        />
        <FilterSelect
          name="status"
          label="สถานะ"
          defaultValue={status}
          options={[{ value: "", label: "ทุกสถานะ" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" icon={Search} className="flex-1 sm:flex-none">
            ค้นหา
          </Button>
          {(q || status) && (
            <ButtonLink href={kind ? kindHref("/requests", kind) : "/requests"} variant="ghost" icon={X}>
              ล้างตัวกรอง
            </ButtonLink>
          )}
        </div>
      </FilterBar>

      <TableCard>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>{kind === "PHONE" ? "เบอร์" : kind ? "ศูนย์" : COLUMN.service}</th>
              <th className={thClass}>{COLUMN.invoice}</th>
              <th className={thClass}>{COLUMN.periodDue}</th>
              <th className={`${thClass} text-right`}>{COLUMN.amount}</th>
              <th className={thClass}>สถานะ</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {requests.map((r, i) => (
              <Fragment key={r.id}>
                {/* หัวกลุ่มสถานะ: ขึ้นเมื่อสถานะเปลี่ยนจากแถวก่อนหน้า */}
                {(i === 0 || requests[i - 1].status !== r.status) && (
                  <tr>
                    {/* สีตามสถานะ + แถบซ้าย (ชุดเดียวกับการ์ด) ให้เห็นชัดว่ากลุ่มเริ่มตรงไหน */}
                    <td colSpan={6} className={cx("border-y border-l-4 px-4 py-2.5", groupSurface(r.status))}>
                      <span className="flex items-center gap-2 text-sm">
                        <span className="font-bold text-slate-900">{STATUS_LABEL[r.status]}</span>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700">
                          {requests.filter((x) => x.status === r.status).length} ใบ
                        </span>
                        <span className="text-xs text-slate-600">{STATUS_CARD[r.status].sub}</span>
                      </span>
                    </td>
                  </tr>
                )}
                <ClickableRow href={`/requests/${r.id}`}>
                  <td className={tdClass}>
                    <ServiceCell center={r.center} href={`/requests/${r.id}`} showTag={!kind} />
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
                    <div className="flex flex-wrap items-center gap-1">
                      <RequestStatusBadge status={r.status} />
                      {returnedBy(r.status, r.logs) && <Badge tone="red">ถูกตีกลับ</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">สร้าง {formatThaiDate(todayISO(r.createdAt))}</div>
                    {/* แก้/ลบ/ส่งได้เฉพาะเจ้าของใบ — บอกให้รู้ว่าใบไหนของคนอื่น */}
                    {r.createdById !== user.id && <div className="mt-1 text-xs text-slate-500">ผู้จัดทำ: {r.createdBy.name}</div>}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <RowLink href={`/requests/${r.id}`} icon={Eye}>ดู</RowLink>
                  </td>
                </ClickableRow>
              </Fragment>
            ))}
            {requests.length === 0 && (
              <EmptyRow colSpan={7} icon={q || status ? Inbox : FilePlus}>
                {q || status ? "ไม่พบใบเบิกที่ตรงกับการค้นหา" : "ยังไม่มีใบเบิก — กด \"สร้างใบเบิก\" เพื่อเริ่ม"}
              </EmptyRow>
            )}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
