import type { RequestStatus } from "@/generated/prisma/enums";
import { cx } from "@/components/ui";

// แถบติดตามเอกสาร (กระดาษ) แบบบาง 5 ช่อง: ผู้จัดทำ → ผู้อนุมัติ → ส่งบัญชี → บัญชีรับ → จ่ายแล้ว
// ช่องที่ผ่านแล้ว = กรมท่า, ช่องปัจจุบัน = กรมท่าอ่อน — ชื่อขั้นแสดงในบรรทัด "อยู่ที่ …" ของการ์ดแทน (การ์ดกระชับ ผู้ใช้ขอ 2026-10-31)
export const DOC_STEPS: { status: RequestStatus; label: string }[] = [
  { status: "CREATED", label: "ผู้จัดทำ" },
  { status: "PENDING", label: "ผู้อนุมัติ" },
  { status: "APPROVED", label: "ส่งบัญชี" },
  { status: "RECEIVED", label: "บัญชีรับ" },
  { status: "PAID", label: "จ่ายแล้ว" },
];

export function DocTracker({ status }: { status: RequestStatus }) {
  const current = DOC_STEPS.findIndex((s) => s.status === status);
  return (
    <div
      className="flex gap-1"
      role="img"
      aria-label={`ขั้นที่ ${current + 1} จาก ${DOC_STEPS.length}: ${DOC_STEPS[current]?.label ?? ""}`}
    >
      {DOC_STEPS.map((step, i) => (
        <span
          key={step.status}
          title={step.label}
          className={cx(
            "h-1.5 flex-1 rounded-full",
            i < current || status === "PAID" ? "bg-brand-600" : i === current ? "bg-brand-300" : "bg-slate-900/10",
          )}
        />
      ))}
    </div>
  );
}
