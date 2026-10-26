import { cx } from "@/components/ui";
import { formatAmount, toSatang } from "@/lib/money";
import { storedCharges, VAT_PERCENT } from "@/lib/rules/phoneCharges";

// ยอดแยกของใบเบิกค่าโทรศัพท์ตามบิล — แสดงบนหน้าจอให้ผู้ดู/ผู้อนุมัติเห็นชัด (ไม่พิมพ์ใน PDF — ผู้ใช้เลือก 2026-10-26)
// ค่าอินเทอร์เน็ต/ใบที่ไม่มียอดแยก → ไม่แสดงอะไร

type WithCharges = Parameters<typeof storedCharges>[0];

// ตารางแบบในบิล True: แพ็กเกจหลัก / แพ็กเกจเสริมและส่วนเกิน / รวมก่อน VAT / VAT / รวมรอบบิล — มีส่วนเกินไฮไลต์สีเหลือง
export function PhoneChargesTable({ request }: { request: WithCharges }) {
  const c = storedCharges(request);
  if (!c) return null;
  const hasExtra = toSatang(c.extraAmount) > BigInt(0);

  const row = (label: string, amount: string, className?: string) => (
    <div className={cx("flex items-baseline justify-between gap-4 px-4 py-2", className)}>
      <span>{label}</span>
      <span className="tabular-nums">{formatAmount(amount)}</span>
    </div>
  );

  return (
    <section aria-label="รายละเอียดค่าบริการตามบิล">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">รายละเอียดค่าบริการ (ตามบิล)</h3>
        {hasExtra && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">มีค่าแพ็กเกจเสริม/ส่วนเกิน</span>
        )}
      </div>
      <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 text-sm text-slate-700">
        {row("ค่าบริการแพ็กเกจหลัก", c.packageAmount)}
        {row("ค่าบริการแพ็กเกจเสริมและค่าบริการส่วนเกิน", c.extraAmount, hasExtra ? "bg-amber-50 font-medium text-amber-900" : undefined)}
        {row("รวมค่าบริการก่อนภาษีมูลค่าเพิ่ม", c.subtotal, "bg-slate-50 font-medium")}
        {row(`ภาษีมูลค่าเพิ่ม ${VAT_PERCENT}%`, c.vat)}
        {row("รวมค่าบริการรอบบิลปัจจุบัน", c.total, "bg-brand-50 text-base font-bold text-brand-900")}
      </div>
    </section>
  );
}

// ป้ายสั้นใต้ยอดในแถวรายการ (รออนุมัติ / ฝ่ายบัญชี) เฉพาะใบที่มีค่าเสริม/ส่วนเกิน — จุดที่ผู้อนุมัติต้องสังเกต (ยอดแยกเต็มดูในหน้าใบเบิก)
export function PhoneChargesNote({ request, className }: { request: WithCharges; className?: string }) {
  const c = storedCharges(request);
  if (!c || toSatang(c.extraAmount) === BigInt(0)) return null;
  return (
    <div className={cx("whitespace-nowrap text-xs font-medium tabular-nums text-amber-700", className)}>
      ส่วนเกิน {formatAmount(c.extraAmount)}
    </div>
  );
}
