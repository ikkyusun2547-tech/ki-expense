import { ChevronDown, Search } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ComponentType, ReactNode } from "react";

// ชิ้นส่วน UI พื้นฐาน (ไม่มี state ใช้ได้ทั้ง Server/Client Component)
// โทนสี: brand (กรมท่า, globals.css) = หลัก, slate = ตัวอักษร/เส้น, เขียว/แดง/เหลือง/ฟ้า = สถานะ

export type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

// ---------- ปุ่ม ----------
// มาตรฐานทั้งโปรเจกต์ (ผู้ใช้ขอให้ปุ่มเป็นแบบเดียวกันหมด 2026-10-26):
// - primary = งานหลักของหน้า/แถว (ทึบเขียว) · secondary = งานรอง ดู/แก้ไข/ยกเลิก/กลับ/ค้นหา/ดาวน์โหลด (ขอบเทา)
//   danger = ลบ/ไม่อนุมัติ (ขอบแดง) · ghost = ตัวช่วยเล็ก ๆ ล้างตัวกรอง/เลือกทั้งหมด (ไม่มีขอบ)
// - ทุกปุ่มมีไอคอน · md = ในหน้า/ฟอร์ม (และเมื่ออยู่ข้างช่องกรอก) · sm = ในแถวตาราง/การ์ด
// - ห้ามทำลิงก์ตัวหนังสือแทนปุ่ม (ลิงก์ตัวหนังสือใช้ได้เฉพาะในประโยค/ค่าข้อมูล เช่น "เปิดไฟล์" ในตาราง)

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_SIZE = {
  md: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-sm",
};

const BUTTON_VARIANT = {
  primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-900",
  secondary: "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900",
  // ปุ่มทำลายข้อมูลใช้แบบเส้นขอบ ไม่ให้เด่นกว่าปุ่มหลัก
  danger: "border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
};

type ButtonStyle = { variant?: keyof typeof BUTTON_VARIANT; size?: keyof typeof BUTTON_SIZE; icon?: IconType };

function ButtonContent({ icon: Icon, children }: { icon?: IconType; children: ReactNode }) {
  return (
    <>
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      {children}
    </>
  );
}

export function Button({ variant = "primary", size = "md", icon, className, children, ...props }: ComponentProps<"button"> & ButtonStyle) {
  return (
    <button className={cx(BUTTON_BASE, BUTTON_SIZE[size], BUTTON_VARIANT[variant], className)} {...props}>
      <ButtonContent icon={icon}>{children}</ButtonContent>
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", icon, className, children, ...props }: ComponentProps<typeof Link> & ButtonStyle) {
  return (
    <Link className={cx(BUTTON_BASE, BUTTON_SIZE[size], BUTTON_VARIANT[variant], className)} {...props}>
      <ButtonContent icon={icon}>{children}</ButtonContent>
    </Link>
  );
}

// ลิงก์เปิดไฟล์/แท็บใหม่ ที่หน้าตาเหมือนปุ่ม
export function ButtonAnchor({ variant = "primary", size = "md", icon, className, children, ...props }: ComponentProps<"a"> & ButtonStyle) {
  return (
    <a className={cx(BUTTON_BASE, BUTTON_SIZE[size], BUTTON_VARIANT[variant], className)} {...props}>
      <ButtonContent icon={icon}>{children}</ButtonContent>
    </a>
  );
}

// ---------- ฟอร์ม ----------

// ไม่มีความกว้าง — ใช้เมื่อต้องกำหนดความกว้างเอง (Tailwind class ที่ชนกันจะไม่ทับกันตามลำดับที่เขียน)
const inputBase =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-500/10 disabled:bg-slate-50 disabled:text-slate-500";

export const inputClass = `${inputBase} w-full`;

// ---------- แถบค้นหา/กรอง เหนือตาราง ----------

// form GET ธรรมดา: ค่าที่กรอกกลายเป็น ?q=...&status=... ใน URL
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <form
      role="search"
      className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center"
    >
      {children}
    </form>
  );
}

export function SearchInput({ defaultValue, placeholder }: { defaultValue?: string; placeholder: string }) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input name="q" type="search" defaultValue={defaultValue} placeholder={placeholder} aria-label="ค้นหา" className={`${inputClass} pl-9`} />
    </div>
  );
}

// drop-down มาตรฐานทั้งโปรเจกต์ (ผู้ใช้ขอให้ดีไซน์ไปทางเดียวกัน 2026-10-26):
// ลูกศร ⌄ ของระบบเอง (ซ่อนลูกศรเบราว์เซอร์ด้วย appearance-none) สูง/ขอบ/โฟกัสเหมือนช่องกรอก — className = ความกว้างของกล่อง
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className={cx("relative", className ?? "w-full")}>
      <select className={cx(inputBase, "w-full cursor-pointer appearance-none pr-9 disabled:cursor-not-allowed")} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
    </div>
  );
}

export function FilterSelect({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select name={name} defaultValue={defaultValue ?? ""} aria-label={label} className="w-full sm:w-44">
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function Field({
  label,
  htmlFor,
  errors,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  errors?: string[];
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && !errors?.length && <p className="text-xs text-slate-500">{hint}</p>}
      {errors?.map((e) => (
        <p key={e} className="text-xs font-medium text-red-600">
          {e}
        </p>
      ))}
    </div>
  );
}

// ---------- แจ้งเตือน / ป้าย ----------

const ALERT_TONE = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
};

export function Alert({ tone, children }: { tone: keyof typeof ALERT_TONE; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-lg border px-4 py-3 text-sm", ALERT_TONE[tone])}>
      {children}
    </div>
  );
}

const BADGE_TONE = {
  green: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  amber: { badge: "bg-amber-50 text-amber-800 ring-amber-600/20", dot: "bg-amber-500" },
  red: { badge: "bg-red-50 text-red-700 ring-red-600/20", dot: "bg-red-500" },
  zinc: { badge: "bg-slate-100 text-slate-600 ring-slate-500/20", dot: "bg-slate-400" },
  sky: { badge: "bg-sky-50 text-sky-700 ring-sky-600/20", dot: "bg-sky-500" },
};

export type BadgeTone = keyof typeof BADGE_TONE;

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        BADGE_TONE[tone].badge,
      )}
    >
      <span className={cx("size-1.5 rounded-full", BADGE_TONE[tone].dot)} aria-hidden />
      {children}
    </span>
  );
}

// ---------- โครงหน้า ----------

export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: IconType;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <Icon className="size-5" aria-hidden />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// flush = ไม่มี padding (เนื้อหาจัดระยะเอง เช่น มีเส้นคั่นเต็มความกว้าง)
export function Card({ className, flush, children }: { className?: string; flush?: boolean; children: ReactNode }) {
  return <div className={cx("rounded-xl border border-slate-200 bg-white shadow-sm", !flush && "p-6", className)}>{children}</div>;
}

// หัวข้อขั้นตอนในฟอร์ม: วงกลมตัวเลข + ชื่อขั้น
export function StepTitle({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">{step}</span>
      <div>
        <div className="font-semibold text-slate-900">{title}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
    </div>
  );
}

export function CardTitle({ icon: Icon, children }: { icon?: IconType; children: ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
      {Icon && <Icon className="size-4 text-slate-400" aria-hidden />}
      {children}
    </h2>
  );
}

// ---------- ตัวเลขสรุป ----------

const STAT_TONE = {
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  sky: "bg-sky-100 text-sky-700",
  zinc: "bg-slate-100 text-slate-600",
};

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "zinc",
  href,
  active,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: IconType;
  tone?: keyof typeof STAT_TONE;
  href?: string;
  active?: boolean;
}) {
  const body = (
    <div className="flex items-start gap-4">
      <div className={cx("hidden size-11 shrink-0 items-center justify-center rounded-xl sm:flex", STAT_TONE[tone])}>
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500 sm:text-sm">{label}</div>
        <div className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-2xl">{value}</div>
        {sub && <div className="mt-0.5 hidden text-xs text-slate-500 sm:block">{sub}</div>}
      </div>
    </div>
  );
  const box = cx(
    "block rounded-xl border bg-white p-3 shadow-sm transition sm:p-5",
    active ? "border-brand-500 ring-2 ring-brand-500/20" : "border-slate-200",
    href && "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
  );
  return href ? (
    <Link href={href} className={box} aria-current={active ? "true" : undefined}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

// ---------- ตาราง ----------

export function TableCard({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">{children}</div>;
}

export const tableClass = "w-full text-left text-sm";
export const thClass = "whitespace-nowrap border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-semibold text-slate-500";
export const tdClass = "border-b border-slate-100 px-4 py-3 align-middle text-slate-700";
export const rowClass = "transition-colors hover:bg-slate-50/80";

// ปุ่มในคอลัมน์ท้ายตาราง ("ดู", "แก้ไข") — ปุ่มรองขนาดเล็กแบบเดียวกับปุ่มอื่นในแถว
export function RowLink({ href, icon, children }: { href: string; icon: IconType; children: ReactNode }) {
  return (
    <ButtonLink href={href} variant="secondary" size="sm" icon={icon}>
      {children}
    </ButtonLink>
  );
}

// แถวว่างในตาราง
export function EmptyRow({ colSpan, icon: Icon, children }: { colSpan: number; icon: IconType; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center">
        <Icon className="mx-auto mb-3 size-10 text-slate-300" aria-hidden />
        <div className="text-sm text-slate-500">{children}</div>
      </td>
    </tr>
  );
}

// ชื่อ + รหัสรองในคอลัมน์ตาราง; tag = ป้ายเล็กท้ายรหัส (เช่น ประเภท "โทรศัพท์")
export function NameCell({ name, code, href, tag }: { name: string; code: string; href?: string; tag?: string }) {
  return (
    <div>
      {href ? (
        <Link href={href} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
          {name}
        </Link>
      ) : (
        <div className="font-medium text-slate-900">{name}</div>
      )}
      <div className="text-xs tabular-nums text-slate-400">
        {code}
        {tag && <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-px font-medium text-sky-700">{tag}</span>}
      </div>
    </div>
  );
}
