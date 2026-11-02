import { Building, Download, Smartphone, Wifi } from "lucide-react";
import Link from "next/link";
import { REQUEST_TONE } from "@/components/StatusBadge";
import { Alert, Button, FilterSelect, PageHeader, PillTabs } from "@/components/ui";
import type { ServiceKind } from "@/generated/prisma/enums";
import { kindHref } from "@/lib/auth/routes";
import { centerLabel } from "@/lib/centers/phone";
import { formatAmount } from "@/lib/money";
import { canCreateRequest, STATUS_LABEL } from "@/lib/status";
import { formatThaiDateRange, todayISO } from "@/lib/thai/date";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { getCenterCards, type CenterCardRow } from "@/server/services/summary";
import { CenterCards, type CenterCard } from "./CenterCards";

// การ์ดศูนย์/เบอร์ + ช่องค้นหา: ใบแจ้งหนี้มา → เลือกการ์ด → กรอกใบแจ้งหนี้ (ผู้ใช้เลือก 2026-10-31)
// ไม่เตือน "ใกล้ครบ/เลยกำหนด" แล้ว (ใบแจ้งหนี้แต่ละที่มาไม่ตรงกัน) — การ์ดบอกใบเบิกล่าสุดและสถานะของใบนั้นแทน
const KIND_TAB: Record<ServiceKind, { label: string; noun: string; title: string }> = {
  INTERNET: { label: "ค่าอินเทอร์เน็ต", noun: "ศูนย์", title: "ศูนย์ค่าอินเทอร์เน็ต" },
  PHONE: { label: "ค่าโทรศัพท์", noun: "เบอร์", title: "เบอร์โทรศัพท์" },
};

export default async function SummaryPage({ searchParams }: PageProps<"/summary">) {
  const user = await requireUser();
  const today = todayISO();

  const params = await searchParams;
  const all = await getCenterCards();
  const isCreator = canCreateRequest(user.role);

  // ผู้จัดทำ: เพิ่งส่งขออนุมัติจากฟอร์ม (กลับมาทำศูนย์ถัดไป) + ใบที่ยังไม่ส่ง/ถูกตีกลับ
  const sent =
    isCreator && typeof params.sent === "string"
      ? await db.request.findUnique({
          where: { id: params.sent },
          select: { id: true, approverName: true, center: { select: { name: true, kind: true } } },
        })
      : null;

  // ประเภทตามเมนู (?kind=) — ไม่ระบุ = ค่าอินเทอร์เน็ต (หน้าแรกของผู้จัดทำ)
  const kind: ServiceKind = params.kind === "PHONE" ? "PHONE" : "INTERNET";
  const rows = all.filter((r) => r.center.kind === kind);
  const noun = KIND_TAB[kind].noun;
  // ปีที่ดาวน์โหลดตารางรายปีได้: ตั้งแต่ปีของใบเบิกแรกจนถึงปีนี้ (ใหม่สุดก่อน)
  const firstDue = await db.request.findFirst({
    where: { deletedAt: null, center: { kind } },
    orderBy: { dueDate: "asc" },
    select: { dueDate: true },
  });
  const thisYear = Number(today.slice(0, 4));
  const fromYear = Math.min(thisYear, firstDue?.dueDate.getUTCFullYear() ?? thisYear);
  const years = Array.from({ length: thisYear - fromYear + 1 }, (_, i) => thisYear - i);
  const drafts = isCreator ? await db.request.count({ where: { status: "CREATED", deletedAt: null, createdById: user.id, center: { kind } } }) : 0;

  return (
    <>
      <PageHeader
        icon={Building}
        title={KIND_TAB[kind].title}
        description={
          isCreator ? `ใบแจ้งหนี้มาแล้ว → ค้นหาแล้วกดการ์ด${noun}นั้นเพื่อสร้างใบเบิก · ทั้งหมด ${rows.length} ${noun}` : `ทั้งหมด ${rows.length} ${noun} · ใบเบิกล่าสุดของแต่ละ${noun}`
        }
      />

      {/* ค่าอินเทอร์เน็ต / ค่าโทรศัพท์ = แท็บในหน้า */}
      <PillTabs
        label="ประเภทค่าบริการ"
        tabs={(["INTERNET", "PHONE"] as const).map((k) => ({
          href: kindHref("/summary", k),
          label: KIND_TAB[k].label,
          icon: k === "PHONE" ? Smartphone : Wifi,
          active: kind === k,
        }))}
      />

      {(sent || drafts > 0) && (
        <div className="mb-6 flex flex-col gap-3">
          {sent && (
            <Alert tone="success">
              ส่งใบเบิก <span className="font-semibold">{sent.center.name}</span> ให้ {sent.approverName} อนุมัติแล้ว — ทำ{noun}ถัดไปได้เลย ·{" "}
              <Link href={`/requests/${sent.id}`} className="font-medium underline">
                ดู/พิมพ์ใบเบิก
              </Link>
            </Alert>
          )}
          {drafts > 0 && (
            <Alert tone="warning">
              ใบเบิก{KIND_TAB[kind].label}ของคุณที่ยังไม่ส่งขออนุมัติ <span className="font-semibold">{drafts} ใบ</span> (รวมใบที่ผู้อนุมัติส่งกลับให้แก้) ·{" "}
              <Link href={`${kindHref("/requests", kind)}&status=CREATED`} className="font-medium underline">
                ดูรายการ
              </Link>
            </Alert>
          )}
        </div>
      )}

      <CenterCards
        cards={rows.map((r) => toCard(r, isCreator))}
        noun={noun}
        emptyText={`ยังไม่มี${noun}ที่ใช้งานอยู่ในทะเบียน`}
      />

      {/* ตารางรายปีแบบที่เคยเขียนมือ (Excel) — ฟอร์ม GET ธรรมดา ไฟล์ดาวน์โหลดโดยไม่เปลี่ยนหน้า */}
      <form method="get" action="/api/reports/yearly" className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <input type="hidden" name="kind" value={kind} />
        <span className="text-sm text-slate-600">ตารางรายปี (Excel):</span>
        <FilterSelect name="year" label="ปี" defaultValue={String(thisYear)} options={years.map((y) => ({ value: String(y), label: `ปี ${y + 543}` }))} />
        <Button type="submit" variant="secondary" icon={Download}>
          ดาวน์โหลด
        </Button>
      </form>
    </>
  );
}

// ผู้จัดทำ: ใบล่าสุดยัง "สร้างแล้ว" (ยังไม่ส่ง) → กดการ์ด = เปิดใบนั้นทำต่อ + ลิงก์รอง "สร้างใบใหม่" (ผู้ใช้สงสัย 2026-10-31 ว่าทำไมไปหน้าสร้างทั้งที่มีใบแล้ว)
//           สถานะอื่น/ยังไม่เคยเบิก → กดการ์ด = สร้างใบเบิก (กฎกันซ้ำตรวจที่ฟอร์ม) + ลิงก์รอง "ดูใบล่าสุด"
// บทบาทอื่น: กดการ์ด = ดูใบล่าสุด (ยังไม่เคยเบิก = การ์ดเฉย ๆ)
function cardAction(r: CenterCardRow, isCreator: boolean, viewHref: string | null): Pick<CenterCard, "href" | "action" | "link"> {
  if (!isCreator) return { href: viewHref, action: viewHref ? { kind: "view", label: "ดูใบเบิก" } : null, link: null };
  const createHref = `/requests/new?code=${encodeURIComponent(r.center.customerCode)}`;
  if (r.latest?.status === "CREATED" && viewHref) {
    return { href: viewHref, action: { kind: "continue", label: "ทำต่อ (ยังไม่ส่ง)" }, link: { href: createHref, label: "สร้างใบใหม่", kind: "create" } };
  }
  return { href: createHref, action: { kind: "create", label: "สร้างใบเบิก" }, link: viewHref ? { href: viewHref, label: "ดูใบล่าสุด", kind: "view" } : null };
}

function toCard(r: CenterCardRow, isCreator: boolean): CenterCard {
  const { name, code } = centerLabel(r.center);
  const viewHref = r.latest ? `/requests/${r.latest.id}` : null;
  return {
    id: r.center.id,
    phone: r.center.kind === "PHONE",
    name,
    code,
    provider: r.center.provider,
    normalAmount: formatAmount(r.center.normalAmount),
    latestPeriod: r.latest ? formatThaiDateRange(r.latest.periodStart, r.latest.periodEnd) : null,
    // สีการ์ด = สถานะของใบล่าสุด (ยังไม่เคยเบิก = เทา)
    status: r.latest
      ? { label: STATUS_LABEL[r.latest.status], tone: REQUEST_TONE[r.latest.status] }
      : { label: "ยังไม่เคยเบิก", tone: "zinc" },
    ...cardAction(r, isCreator, viewHref),
    search: [r.center.name, r.center.customerCode, r.center.serviceNumber ?? "", code].join(" "),
  };
}
