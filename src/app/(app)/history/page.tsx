import { ArrowLeft, CalendarDays, ChevronRight, Inbox, Layers, Smartphone, Wifi } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { REQUEST_TONE, RequestStatusBadge } from "@/components/StatusBadge";
import { ButtonLink, cx, PageHeader, PillTabs, TONE_SURFACE, type BadgeTone } from "@/components/ui";
import type { Prisma } from "@/generated/prisma/client";
import type { RequestStatus, ServiceKind } from "@/generated/prisma/enums";
import { centerLabel } from "@/lib/centers/phone";
import { formatAmount, fromSatang, toSatang } from "@/lib/money";
import { SERVICE_KIND_LABEL, STATUS_LABEL } from "@/lib/status";
import { formatThaiDate, formatThaiMonth, isMonthKey, monthRange, todayISO } from "@/lib/thai/date";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

// ประวัติการทำเรื่องเบิก (ผู้ใช้ขอ 2026-10-31: "เดือนไหนสร้างใบเบิกกี่ใบ ใช้ทำอะไร ยังไง") — ทุกบทบาท เห็นทุกใบ
// นับตาม "เดือนที่สร้างใบเบิกในระบบ" (เวลาไทย) ไม่ใช่วันครบกำหนดชำระ
// หน้าแรก = การ์ดเดือนละใบ (ใหม่สุดก่อน) · ?month=YYYY-MM = รายการทุกใบของเดือนนั้น · ?kind= = เฉพาะประเภท
const KINDS: ServiceKind[] = ["INTERNET", "PHONE"];
const STATUS_ORDER: RequestStatus[] = ["CREATED", "PENDING", "APPROVED", "RECEIVED", "PAID"];

// สีแถบสัดส่วนสถานะ (สีเดียวกับป้ายสถานะ)
const BAR_COLOR: Record<BadgeTone, string> = {
  zinc: "bg-slate-400",
  amber: "bg-amber-400",
  sky: "bg-sky-400",
  violet: "bg-violet-400",
  green: "bg-emerald-500",
  red: "bg-red-400",
};

type Row = { createdAt: Date; status: RequestStatus; amount: { toFixed(dp: number): string }; center: { kind: ServiceKind } };

type MonthSummary = {
  month: string;
  count: number;
  satang: bigint;
  byKind: Record<ServiceKind, { count: number; satang: bigint }>;
  byStatus: Record<RequestStatus, number>;
};

function summarize(rows: Row[]): MonthSummary[] {
  const map = new Map<string, MonthSummary>();
  for (const r of rows) {
    const month = todayISO(r.createdAt).slice(0, 7);
    const m = map.get(month) ?? {
      month,
      count: 0,
      satang: BigInt(0),
      byKind: { INTERNET: { count: 0, satang: BigInt(0) }, PHONE: { count: 0, satang: BigInt(0) } },
      byStatus: { CREATED: 0, PENDING: 0, APPROVED: 0, RECEIVED: 0, PAID: 0 },
    };
    const satang = toSatang(r.amount);
    m.count++;
    m.satang += satang;
    m.byKind[r.center.kind].count++;
    m.byKind[r.center.kind].satang += satang;
    m.byStatus[r.status]++;
    map.set(month, m);
  }
  return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
}

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  await requireUser();
  const params = await searchParams;
  const kind = KINDS.find((k) => k === params.kind);
  const month = typeof params.month === "string" && isMonthKey(params.month) ? params.month : undefined;

  const href = (p: { kind?: ServiceKind; month?: string }) => {
    const q = new URLSearchParams({ ...(p.kind && { kind: p.kind }), ...(p.month && { month: p.month }) });
    return q.size ? `/history?${q}` : "/history";
  };
  const kindTabs = (
    <PillTabs
      label="ประเภทค่าบริการ"
      tabs={[
        { href: href({ month }), label: "ทั้งหมด", icon: Layers, active: !kind },
        { href: href({ kind: "INTERNET", month }), label: "ค่าอินเทอร์เน็ต", icon: Wifi, active: kind === "INTERNET" },
        { href: href({ kind: "PHONE", month }), label: "ค่าโทรศัพท์", icon: Smartphone, active: kind === "PHONE" },
      ]}
    />
  );
  const where = { deletedAt: null, ...(kind && { center: { kind } }), ...(month && { createdAt: monthRange(month) }) };

  if (month) return <MonthDetail month={month} kind={kind} where={where} kindTabs={kindTabs} backHref={href({ kind })} />;

  const months = summarize(
    await db.request.findMany({ where, select: { createdAt: true, status: true, amount: true, center: { select: { kind: true } } } }),
  );

  return (
    <>
      <PageHeader icon={CalendarDays} title="ประวัติการทำเรื่องเบิก" description="แต่ละเดือนสร้างใบเบิกกี่ใบ เป็นค่าอะไร และถึงขั้นไหนแล้ว — นับตามวันที่สร้างใบเบิก" />
      {kindTabs}

      {months.length === 0 ? (
        <Empty>ยังไม่มีใบเบิก</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {months.map((m) => {
            const done = m.byStatus.PAID;
            return (
              <li key={m.month}>
                {/* การ์ดเดือน: จ่ายครบทุกใบ = เขียว · ยังมีใบค้าง = ฟ้า */}
                <Link
                  href={href({ kind, month: m.month })}
                  className={cx(
                    "group flex flex-col gap-3 rounded-2xl border border-l-4 px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                    TONE_SURFACE[done === m.count ? "green" : "sky"],
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="text-lg font-bold text-slate-900">{formatThaiMonth(m.month)}</div>
                    <div className="text-sm text-slate-600">
                      <b className="text-base text-slate-900">{m.count}</b> ใบ ·{" "}
                      <b className="tabular-nums text-slate-900">{formatAmount(fromSatang(m.satang))}</b> บาท
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm">
                    {KINDS.filter((k) => !kind || k === kind).map((k) => (
                      <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-slate-700">
                        {k === "PHONE" ? <Smartphone className="size-4 text-orange-600" aria-hidden /> : <Wifi className="size-4 text-sky-600" aria-hidden />}
                        ค่า{SERVICE_KIND_LABEL[k]} <b className="tabular-nums">{m.byKind[k].count}</b> ใบ
                        {m.byKind[k].count > 0 && <span className="tabular-nums text-slate-500">· {formatAmount(fromSatang(m.byKind[k].satang))}</span>}
                      </span>
                    ))}
                  </div>

                  {/* สัดส่วนสถานะของใบในเดือนนั้น */}
                  <div className="flex h-2 overflow-hidden rounded-full bg-slate-900/10" aria-hidden>
                    {STATUS_ORDER.map((s) =>
                      m.byStatus[s] ? <span key={s} className={BAR_COLOR[REQUEST_TONE[s]]} style={{ width: `${(m.byStatus[s] / m.count) * 100}%` }} /> : null,
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    {STATUS_ORDER.filter((s) => m.byStatus[s]).map((s) => (
                      <span key={s} className="inline-flex items-center gap-1">
                        <span className={cx("size-2 rounded-full", BAR_COLOR[REQUEST_TONE[s]])} aria-hidden />
                        {STATUS_LABEL[s]} {m.byStatus[s]}
                      </span>
                    ))}
                    <span className="ml-auto inline-flex items-center gap-0.5 font-medium text-brand-700">
                      ดูรายการ <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// รายการทุกใบที่สร้างในเดือนนั้น: ใครสร้าง เป็นค่าอะไรของศูนย์ไหน ยอดเท่าไร ตอนนี้ถึงขั้นไหน (การ์ดสีตามสถานะ — ไม่ล้นจอมือถือ)
async function MonthDetail({
  month,
  kind,
  where,
  kindTabs,
  backHref,
}: {
  month: string;
  kind?: ServiceKind;
  where: Prisma.RequestWhereInput;
  kindTabs: ReactNode;
  backHref: string;
}) {
  const requests = await db.request.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { center: { select: { kind: true, name: true, customerCode: true } }, createdBy: { select: { name: true } } },
  });
  const [m] = summarize(requests);

  return (
    <>
      <PageHeader
        icon={CalendarDays}
        title={`ประวัติเดือน${formatThaiMonth(month)}`}
        description={
          m
            ? `สร้างใบเบิก ${m.count} ใบ · รวม ${formatAmount(fromSatang(m.satang))} บาท${kind ? ` (ค่า${SERVICE_KIND_LABEL[kind]})` : ""}`
            : "ไม่มีใบเบิกที่สร้างในเดือนนี้"
        }
        actions={
          <ButtonLink href={backHref} variant="secondary" icon={ArrowLeft}>
            ทุกเดือน
          </ButtonLink>
        }
      />
      {kindTabs}

      {requests.length === 0 ? (
        <Empty>ไม่มีใบเบิกที่สร้างในเดือน{formatThaiMonth(month)}</Empty>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {requests.map((r) => {
            const { name, code } = centerLabel(r.center);
            return (
              <li key={r.id}>
                <Link
                  href={`/requests/${r.id}`}
                  className={cx(
                    "flex flex-col gap-2 rounded-2xl border border-l-4 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:gap-4",
                    TONE_SURFACE[REQUEST_TONE[r.status]],
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {r.center.kind === "PHONE" ? (
                        <Smartphone className="size-4 shrink-0 text-orange-600" aria-label="ค่าโทรศัพท์" />
                      ) : (
                        <Wifi className="size-4 shrink-0 text-sky-600" aria-label="ค่าอินเทอร์เน็ต" />
                      )}
                      <span className="truncate font-semibold text-slate-900">{name}</span>
                    </div>
                    {/* มือถือ: ขึ้นบรรทัดใหม่ได้ (ไม่ตัดวันที่สร้าง/ผู้สร้าง) · จอใหญ่: บรรทัดเดียว */}
                    <div className="mt-0.5 text-xs text-slate-500 sm:truncate">
                      {code} · ใบแจ้งหนี้ {r.invoiceNo} · สร้าง {formatThaiDate(todayISO(r.createdAt))} โดย {r.createdBy.name}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <RequestStatusBadge status={r.status} />
                    <span className="w-28 text-right font-bold tabular-nums text-slate-900">
                      {formatAmount(r.amount)} <span className="text-xs font-normal text-slate-500">บาท</span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-12 text-center text-sm text-slate-500">
      <span className="flex size-14 items-center justify-center rounded-full bg-slate-100">
        <Inbox className="size-7 text-slate-400" aria-hidden />
      </span>
      {children}
    </div>
  );
}
