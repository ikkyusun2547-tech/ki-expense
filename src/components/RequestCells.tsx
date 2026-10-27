import { Paperclip } from "lucide-react";
import type { ReactNode } from "react";
import { DueBadge } from "@/components/DueBadge";
import { PhoneChargesNote } from "@/components/PhoneCharges";
import { cx, NameCell } from "@/components/ui";
import { centerLabel, kindTag } from "@/lib/centers/phone";
import { formatAmount } from "@/lib/money";
import { daysUntil } from "@/lib/rules/centerSummary";
import { formatThaiDate, formatThaiDateRange, toISODate } from "@/lib/thai/date";

// เซลล์มาตรฐานของตารางใบเบิก — ทุกตาราง (ใบเบิก / รออนุมัติ / ฝ่ายบัญชี) เรียงคอลัมน์เหมือนกัน:
// ศูนย์/เบอร์ → ใบแจ้งหนี้ → รอบบริการ/ครบกำหนด → ยอด → ข้อมูลเฉพาะหน้า → ปุ่ม  (ผู้ใช้ขอ "เป็นสัดส่วน ดูง่าย" 2026-10-27)
// บรรทัดหลัก = ตัวเข้ม, บรรทัดรอง = เล็ก/เทา — ให้ตาเห็นของสำคัญก่อน

type Center = { kind: string; name: string; customerCode: string };

export function ServiceCell({ center, href, showTag = true }: { center: Center; href: string; showTag?: boolean }) {
  return (
    <div className="min-w-[9.5rem]">
      <NameCell {...centerLabel(center)} tag={showTag ? kindTag(center) : undefined} href={href} />
    </div>
  );
}

// เลขที่ใบแจ้งหนี้ + ลิงก์เปิดไฟล์ (ไม่มีไฟล์ = แจ้งสีเหลือง)
export function InvoiceCell({ id, invoiceNo, hasFile }: { id: string; invoiceNo: string; hasFile: boolean }) {
  return (
    <div className="leading-tight">
      <div className="whitespace-nowrap tabular-nums text-slate-900">{invoiceNo}</div>
      <div className="mt-1 text-xs">
        {hasFile ? (
          <a
            href={`/api/requests/${id}/invoice`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-brand-700 hover:underline"
          >
            <Paperclip className="size-3" aria-hidden /> เปิดไฟล์
          </a>
        ) : (
          <span className="font-medium text-amber-700">ไม่ได้แนบไฟล์</span>
        )}
      </div>
    </div>
  );
}

// รอบบริการ (บรรทัดหลัก) + ครบกำหนด (บรรทัดรอง) — today = แสดงป้ายนับวัน (เฉพาะงานที่ยังค้าง)
export function PeriodDueCell({
  periodStart,
  periodEnd,
  dueDate,
  today,
}: {
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  today?: string;
}) {
  const due = toISODate(dueDate);
  return (
    <div className="whitespace-nowrap leading-tight">
      <div className="text-slate-900">{formatThaiDateRange(toISODate(periodStart), toISODate(periodEnd))}</div>
      <div className="mt-1 text-xs text-slate-500">ครบกำหนด {formatThaiDate(due)}</div>
      {/* ป้ายนับวันแยกบรรทัด — สิ่งที่ต้องสังเกตก่อน และไม่ทำให้คอลัมน์กว้างจนตารางล้นจอ */}
      {today && (
        <div className="mt-1.5">
          <DueBadge daysLeft={daysUntil(today, due)} />
        </div>
      )}
    </div>
  );
}

export function AmountCell({
  request,
}: {
  request: { amount: { toFixed(dp: number): string }; packageAmount: { toFixed(dp: number): string } | null; extraAmount: { toFixed(dp: number): string } | null };
}) {
  return (
    <div className="text-right">
      <div className="font-semibold tabular-nums text-slate-900">{formatAmount(request.amount)}</div>
      <PhoneChargesNote request={request} />
    </div>
  );
}

// หัวคอลัมน์มาตรฐาน (ให้ข้อความตรงกันทุกตาราง)
export const COLUMN = {
  service: "ศูนย์ / เบอร์",
  invoice: "ใบแจ้งหนี้",
  periodDue: "รอบบริการ / ครบกำหนด",
  amount: "ยอด (บาท)",
} as const;

// เซลล์ข้อความสองบรรทัดทั่วไป (เช่น วันที่จ่าย + เลขอ้างอิง)
export function TwoLine({ main, sub, className }: { main: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("whitespace-nowrap leading-tight", className)}>
      <div className="text-slate-900">{main}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
