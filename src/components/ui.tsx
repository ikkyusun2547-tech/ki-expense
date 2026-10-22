import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// ชิ้นส่วน UI พื้นฐาน (ไม่มี state ใช้ได้ทั้ง Server/Client Component)

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANT = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-800",
  secondary: "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-zinc-700 hover:bg-zinc-100",
};

type Variant = keyof typeof BUTTON_VARIANT;

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], className)} {...props} />;
}

export const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 aria-[invalid=true]:border-red-500";

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
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-800">
        {label}
      </label>
      {children}
      {hint && !errors?.length && <p className="text-xs text-zinc-500">{hint}</p>}
      {errors?.map((e) => (
        <p key={e} className="text-xs text-red-600">
          {e}
        </p>
      ))}
    </div>
  );
}

const ALERT_TONE = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
};

export function Alert({ tone, children }: { tone: keyof typeof ALERT_TONE; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-md border px-4 py-3 text-sm", ALERT_TONE[tone])}>
      {children}
    </div>
  );
}

const BADGE_TONE = {
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  zinc: "bg-zinc-100 text-zinc-700",
  sky: "bg-sky-100 text-sky-800",
};

export type BadgeTone = keyof typeof BADGE_TONE;

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", BADGE_TONE[tone])}>
      {children}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-600">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-lg border border-zinc-200 bg-white p-6 shadow-sm", className)}>{children}</div>;
}

export const tableClass = "w-full text-left text-sm";
export const thClass = "border-b border-zinc-200 bg-zinc-50 px-3 py-2 font-medium text-zinc-600";
export const tdClass = "border-b border-zinc-100 px-3 py-2 align-middle";
