import { ChevronDown, Search } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ComponentType, ReactNode } from "react";

// ชิ้นส่วน UI พื้นฐาน (ไม่มี state ใช้ได้ทั้ง Server/Client Component)
// โทนสี: brand (กรมท่า, globals.css) = หลัก, slate = ตัวอักษร/เส้น, เขียว/แดง/เหลือง/ฟ้า = สถานะ
// แนว "สดใส เป็นกันเอง" (2026-10-31): การ์ด rounded-2xl ขอบจาง, ปุ่ม/ช่องกรอก rounded-xl, ไอคอนในวงสีพาสเทล

export type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

// ---------- ปุ่ม ----------
// มาตรฐานทั้งโปรเจกต์ (ผู้ใช้ขอให้ปุ่มเป็นแบบเดียวกันหมด 2026-10-26):
// - primary = งานหลักของหน้า/แถว (ทึบเขียว) · secondary = งานรอง ดู/แก้ไข/ยกเลิก/กลับ/ค้นหา/ดาวน์โหลด (ขอบเทา)
//   danger = ลบ/ไม่อนุมัติ (ขอบแดง) · ghost = ตัวช่วยเล็ก ๆ ล้างตัวกรอง/เลือกทั้งหมด (ไม่มีขอบ)
//   soft = งานรองที่ควรสังเกตเห็น (พื้นกรมท่าอ่อน เช่น บันทึกไว้ก่อน) · info = ดู/ตรวจก่อนทำจริง (พื้นฟ้าอ่อน เช่น ดูตัวอย่าง PDF)
//   — แถบปุ่มที่มีหลายปุ่มรอง ใช้สีต่างกันให้แยกออก (ผู้ใช้ขอ 2026-10-31 "ปุ่มขาวสังเกตยาก")
// - ทุกปุ่มมีไอคอน · md = ในหน้า/ฟอร์ม (และเมื่ออยู่ข้างช่องกรอก) · sm = ในแถวตาราง/การ์ด
// - ห้ามทำลิงก์ตัวหนังสือแทนปุ่ม (ลิงก์ตัวหนังสือใช้ได้เฉพาะในประโยค/ค่าข้อมูล เช่น "เปิดไฟล์" ในตาราง)

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_SIZE = {
  md: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-sm",
};

const BUTTON_VARIANT = {
  primary: "bg-brand-700 text-white shadow-sm shadow-brand-700/20 hover:bg-brand-600 active:bg-brand-800",
  secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800",
  // ปุ่มทำลายข้อมูลใช้แบบเส้นขอบ ไม่ให้เด่นกว่าปุ่มหลัก
  danger: "border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  soft: "border border-brand-300 bg-brand-100 text-brand-800 shadow-sm hover:border-brand-400 hover:bg-brand-200",
  info: "border border-sky-300 bg-sky-100 text-sky-800 shadow-sm hover:border-sky-400 hover:bg-sky-200",
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
  "h-10 rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-600/10 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-500/10 disabled:bg-slate-50 disabled:text-slate-500";

export const inputClass = `${inputBase} w-full`;

// ---------- แถบค้นหา/กรอง เหนือตาราง ----------

// form GET ธรรมดา: ค่าที่กรอกกลายเป็น ?q=...&status=... ใน URL
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <form
      role="search"
      className="mb-4 flex flex-col gap-2 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm sm:flex-row sm:items-center"
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
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-xl border px-4 py-3 text-sm", ALERT_TONE[tone])}>
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
  violet: { badge: "bg-violet-50 text-violet-700 ring-violet-600/20", dot: "bg-violet-500" },
};

export type BadgeTone = keyof typeof BADGE_TONE;

// พื้นการ์ดตามสถานะ (ผู้ใช้ขอ 2026-10-31 — การ์ดขาวกลืนกับพื้นหลัง): สีอ่อน + แถบสีด้านซ้าย สีเดียวกับป้ายสถานะ ไม่ฉูดฉาด
// ใช้คู่กับ "border border-l-4"; กล่องย่อยในการ์ดใช้พื้น bg-slate-900/5 (เข้มขึ้นเล็กน้อยได้ทุกสี)
export const TONE_SURFACE: Record<BadgeTone, string> = {
  green: "border-emerald-200 border-l-emerald-400 bg-emerald-50",
  amber: "border-amber-200 border-l-amber-400 bg-amber-50",
  red: "border-red-200 border-l-red-400 bg-red-50",
  sky: "border-sky-200 border-l-sky-400 bg-sky-50",
  violet: "border-violet-200 border-l-violet-400 bg-violet-50",
  // สถานะเทา (เช่น ยังอยู่ที่ผู้จัดทำ) = การ์ดขาวขอบเข้ม ให้แยกจากพื้นหลังได้
  zinc: "border-slate-300 border-l-slate-500 bg-white",
};

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

// greeting = บรรทัดทักทายเหนือหัวข้อ (หน้าแรกของแต่ละบทบาท — ดู Greeting)
export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
  greeting,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: IconType;
  greeting?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3.5">
        {Icon && (
          <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-700/20">
            <Icon className="size-5" aria-hidden />
          </div>
        )}
        <div>
          {greeting && <p className="mb-1 text-sm font-medium text-brand-600">{greeting}</p>}
          <h1 className="text-2xl font-bold leading-snug tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// flush = ไม่มี padding (เนื้อหาจัดระยะเอง เช่น มีเส้นคั่นเต็มความกว้าง)
export function Card({ className, flush, children }: { className?: string; flush?: boolean; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-slate-200/70 bg-white shadow-sm", !flush && "p-6", className)}>{children}</div>;
}

// การ์ดขั้นตอนของฟอร์มยาว (เช่น สร้างใบเบิก): แถบหัวสีกรมท่าอ่อน + วงตัวเลข แล้วเนื้อหา — แยกขั้นให้เห็นชัด ไม่ขาวโล่งทั้งหน้า (ผู้ใช้ขอ 2026-10-31)
export function StepCard({
  step,
  title,
  hint,
  disabled,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={cx("overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm", disabled && "opacity-60")}>
      <div className="flex items-start gap-3 border-b border-brand-100 bg-brand-50 px-5 py-3.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white shadow-sm shadow-brand-700/30">
          {step}
        </span>
        <div>
          <div className="font-semibold text-slate-900">{title}</div>
          {hint && <div className="text-xs text-slate-500">{hint}</div>}
        </div>
      </div>
      {children && <div className="p-5">{children}</div>}
    </section>
  );
}

// การ์ดหัวข้อ: แถบหัวสีกรมท่าอ่อน + ไอคอน (+ ปุ่มด้านขวา) — หน้ารายละเอียด ชุดเดียวกับ StepCard ในฟอร์ม
// flush = เนื้อหาไม่มีระยะขอบ (เช่น ตัวแสดงไฟล์เต็มกว้าง)
export function SectionCard({
  icon: Icon,
  title,
  actions,
  flush,
  className,
  children,
}: {
  icon?: IconType;
  title: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm", className)}>
      <div className="flex items-center gap-2.5 border-b border-brand-100 bg-brand-50 px-5 py-3">
        {Icon && (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
        <h2 className="min-w-0 flex-1 truncate font-semibold text-slate-900">{title}</h2>
        {actions}
      </div>
      <div className={flush ? undefined : "p-5"}>{children}</div>
    </section>
  );
}

// หัวข้อขั้นตอนในฟอร์ม: วงกลมตัวเลข + ชื่อขั้น
export function StepTitle({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 ring-4 ring-brand-50">{step}</span>
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
      {Icon && (
        <span className="flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="size-4" aria-hidden />
        </span>
      )}
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
  violet: "bg-violet-100 text-violet-700",
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
      <div className={cx("hidden size-12 shrink-0 items-center justify-center rounded-2xl sm:flex", STAT_TONE[tone])}>
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500 sm:text-sm">{label}</div>
        <div className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">{value}</div>
        {sub && <div className="mt-0.5 hidden text-xs text-slate-500 sm:block">{sub}</div>}
      </div>
    </div>
  );
  const box = cx(
    "block rounded-2xl border bg-white p-3 shadow-sm transition sm:p-5",
    active ? "border-brand-400 bg-brand-50/50 ring-4 ring-brand-500/10" : "border-slate-200/70",
    href && "hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md",
  );
  return href ? (
    <Link href={href} className={box} aria-current={active ? "true" : undefined}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

// ---------- แท็บในหน้า ----------

// แท็บแบบเม็ดยา: เลือกประเภท/มุมมองในหน้า (ค่าอยู่ใน URL — ลิงก์ธรรมดา) เช่น ค่าอินเทอร์เน็ต | ค่าโทรศัพท์
export type PillTab = { href: string; label: string; icon?: IconType; count?: number; active: boolean };

export function PillTabs({ tabs, label }: { tabs: PillTab[]; label: string }) {
  return (
    <nav aria-label={label} className="mb-5 flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white p-1 text-sm shadow-sm sm:inline-flex">
      {tabs.map(({ href, label: text, icon: Icon, count, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cx(
            "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 font-medium transition-colors sm:flex-none sm:px-4",
            active ? "bg-brand-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {Icon && <Icon className="size-4" aria-hidden />}
          {text}
          {count ? <span className={cx("rounded-full px-1.5 text-xs", active ? "bg-white/20" : "bg-slate-100 text-slate-600")}>{count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

// ---------- ตาราง ----------

export function TableCard({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm">{children}</div>;
}

export const tableClass = "w-full text-left text-sm";
export const thClass = "whitespace-nowrap border-b border-slate-100 bg-slate-50/60 px-4 py-3 text-xs font-semibold text-slate-500";
export const tdClass = "border-b border-slate-100 px-4 py-3 align-middle text-slate-700";
// ตารางที่คอลัมน์เยอะ (มีช่องกรอกในแถว) — ช่องไฟแคบลงให้พอดีจอ 1280
export const thClassDense = thClass.replace("px-4", "px-3");
export const tdClassDense = tdClass.replace("px-4", "px-3");
export const rowClass = "transition-colors hover:bg-brand-50/50";

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
        <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-slate-100">
          <Icon className="size-7 text-slate-400" aria-hidden />
        </span>
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
        <Link href={href} className="font-medium text-slate-900 hover:text-brand-700 hover:underline group-hover:text-brand-700 group-hover:underline">
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
