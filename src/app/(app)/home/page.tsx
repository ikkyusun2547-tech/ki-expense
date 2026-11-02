import { ArrowRight, Building, Clock, MapPin, PartyPopper, Smartphone, Wifi } from "lucide-react";
import Link from "next/link";
import { DOC_STEPS, DocTracker } from "@/components/DocTracker";
import { REQUEST_TONE } from "@/components/StatusBadge";
import { cx, TONE_SURFACE, type IconType } from "@/components/ui";
import type { ServiceKind } from "@/generated/prisma/enums";
import { kindHref } from "@/lib/auth/routes";
import { centerLabel } from "@/lib/centers/phone";
import { formatAmount } from "@/lib/money";
import { documentLocation } from "@/lib/status";
import { formatThaiDate, thaiHour, todayISO } from "@/lib/thai/date";
import { greeting } from "@/lib/thai/name";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";

// หน้าแรกแบบแอป (ผู้ใช้เลือก 2026-10-31): ทักทาย + ปุ่มใหญ่ "เบิกค่าอินเทอร์เน็ต / ค่าโทรศัพท์" + ใบเบิกของฉันอยู่ที่ไหน
// ผู้จัดทำ = ใบของตัวเอง · admin = ทุกใบที่ยังไม่จ่าย
// สีปุ่มใหญ่ = สีประจำประเภท (ไม่ใช่สถานะ — ไม่เตือนวันครบกำหนดแล้ว ผู้ใช้ตัด 2026-10-31)
const TILES: Record<ServiceKind, { title: string; noun: string; icon: IconType; tint: string; surface: string }> = {
  INTERNET: {
    title: "ค่าอินเทอร์เน็ต",
    noun: "ศูนย์",
    icon: Wifi,
    tint: "bg-sky-100 text-sky-700",
    surface: "border-sky-200 border-l-sky-400 bg-sky-50",
  },
  PHONE: {
    title: "ค่าโทรศัพท์",
    noun: "เบอร์",
    icon: Smartphone,
    tint: "bg-orange-100 text-orange-700",
    surface: "border-orange-200 border-l-orange-400 bg-orange-50",
  },
};

export default async function HomePage() {
  const user = await requireRole("CREATOR", "ADMIN");
  const today = todayISO();
  const isCreator = user.role === "CREATOR";

  // ใบที่ยังไม่จ่าย: ผู้จัดทำ = ของตัวเอง · admin = ทั้งหมด
  const openWhere = { deletedAt: null, status: { not: "PAID" as const }, ...(isCreator && { createdById: user.id }) };
  const [centerCounts, openCounts, open] = await Promise.all([
    db.center.groupBy({ by: ["kind"], where: { status: "ACTIVE" }, _count: true }),
    Promise.all((["INTERNET", "PHONE"] as const).map((kind) => db.request.count({ where: { ...openWhere, center: { kind } } }))),
    db.request.findMany({
      where: openWhere,
      orderBy: [{ updatedAt: "desc" }],
      include: { center: { select: { kind: true, name: true, customerCode: true } }, createdBy: { select: { name: true } } },
      take: 30,
    }),
  ]);

  return (
    <>
      {/* แบนเนอร์ทักทาย */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 px-6 pb-16 pt-7 text-white shadow-lg shadow-brand-900/10 sm:px-8">
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -bottom-24 right-24 size-48 rounded-full bg-accent-500/25" aria-hidden />
        <p className="relative text-sm font-medium text-brand-100">{greeting(user.name, thaiHour())}</p>
        <h1 className="relative mt-2 text-2xl font-bold leading-snug sm:text-3xl sm:leading-snug">{isCreator ? "วันนี้จะเบิกอะไรดี?" : "ภาพรวมวันนี้"}</h1>
        <p className="relative mt-1 text-sm text-brand-100">{formatThaiDate(today, "long")}</p>
      </section>

      {/* ปุ่มใหญ่ ลอยทับแบนเนอร์ */}
      <div className="relative -mt-10 grid gap-4 px-2 sm:grid-cols-2 sm:px-4">
        {(["INTERNET", "PHONE"] as const).map((kind, i) => (
          <KindTile
            key={kind}
            kind={kind}
            centers={centerCounts.find((c) => c.kind === kind)?._count ?? 0}
            open={openCounts[i]}
            canCreate={isCreator}
          />
        ))}
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isCreator ? "ใบเบิกของฉันอยู่ที่ไหน" : "ใบเบิกที่ยังไม่จ่าย"}</h2>
            <p className="text-sm text-slate-500">ติดตามใบเบิกกระดาษ — ถึงมือใครแล้ว</p>
          </div>
          <Link href="/requests" className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-brand-700 hover:underline">
            ดูทั้งหมด <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        {open.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-200/70 bg-white px-4 py-12 text-center shadow-sm">
            <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50">
              <PartyPopper className="size-7 text-emerald-600" aria-hidden />
            </span>
            <p className="font-medium text-slate-700">ไม่มีใบเบิกค้าง — ทุกใบจ่ายเรียบร้อยแล้ว</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {open.map((r) => {
              const { name, code } = centerLabel(r.center);
              const step = DOC_STEPS.findIndex((st) => st.status === r.status) + 1;
              return (
                <li key={r.id}>
                  {/* การ์ดกระชับ: ชื่อ + ยอด / รหัส · ใบแจ้งหนี้ / แถบ 5 ช่อง / อยู่ที่ใคร — พื้นตามสถานะ */}
                  <Link
                    href={`/requests/${r.id}`}
                    className={cx(
                      "flex flex-col gap-2.5 rounded-2xl border border-l-4 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                      TONE_SURFACE[REQUEST_TONE[r.status]],
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="truncate font-semibold text-slate-900">{name}</div>
                      <div className="whitespace-nowrap font-bold tabular-nums text-slate-900">
                        {formatAmount(r.amount)} <span className="text-xs font-normal text-slate-500">บาท</span>
                      </div>
                    </div>
                    <div className="-mt-2 truncate text-xs text-slate-500">
                      {code} · ใบแจ้งหนี้ {r.invoiceNo}
                    </div>
                    <DocTracker status={r.status} />
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <MapPin className="size-3.5 shrink-0 text-brand-500" aria-hidden />
                      <span className="truncate">
                        อยู่ที่ <span className="font-semibold text-slate-800">{documentLocation(r)}</span>
                      </span>
                      <span className="ml-auto shrink-0 tabular-nums text-slate-400">
                        {step}/{DOC_STEPS.length}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

// ปุ่มใหญ่ต่อประเภท → หน้าการ์ดเลือกศูนย์/เบอร์ · open = ใบที่กำลังดำเนินการ (ยังไม่ถึงจ่ายแล้ว — ของฉัน / ทั้งหมดสำหรับ admin)
// canCreate = ผู้จัดทำ ("เบิกค่า…") · admin ดูอย่างเดียว
function KindTile({ kind, centers, open, canCreate }: { kind: ServiceKind; centers: number; open: number; canCreate: boolean }) {
  const tile = TILES[kind];
  const Icon = tile.icon;
  return (
    <Link
      href={kindHref("/summary", kind)}
      className={cx(
        "group flex flex-col rounded-3xl border border-l-4 p-5 shadow-lg shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-xl",
        tile.surface,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cx("flex size-14 items-center justify-center rounded-2xl", tile.tint)}>
          <Icon className="size-7" aria-hidden />
        </span>
        <span className="flex size-10 items-center justify-center rounded-full bg-white/80 text-slate-500 transition-colors group-hover:bg-brand-700 group-hover:text-white">
          <ArrowRight className="size-5" aria-hidden />
        </span>
      </div>
      <div className="mt-4 text-xl font-bold text-slate-900">{canCreate ? `เบิก${tile.title}` : tile.title}</div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-700">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1">
          <Building className="size-4 text-slate-400" aria-hidden />
          {centers} {tile.noun}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1">
          <Clock className="size-4 text-slate-400" aria-hidden />
          {open ? `กำลังดำเนินการ ${open} ใบ` : "ไม่มีใบค้าง"}
        </span>
      </div>
    </Link>
  );
}
