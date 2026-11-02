"use client";

import { Building, ChevronRight, Eye, Inbox, Pencil, Plus, Search, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, cx, inputClass, TONE_SURFACE, type BadgeTone } from "@/components/ui";

// การ์ดศูนย์/เบอร์ + ช่องค้นหา (กรองทันทีขณะพิมพ์) — ใบแจ้งหนี้มา → หาการ์ดของศูนย์นั้น → กดเพื่อสร้างใบเบิก
// href + action = ที่ไปเมื่อกดการ์ดและชื่อปุ่ม (create = สร้างใบเบิก · continue = ทำใบที่ยังไม่ส่งต่อ · view = ดูใบเบิก)
// link = ลิงก์รองซ้ายล่าง (ดูใบล่าสุด / สร้างใบใหม่)
export type CenterCard = {
  id: string;
  phone: boolean;
  name: string;
  code: string;
  provider: string;
  normalAmount: string;
  latestPeriod: string | null; // รอบบริการของใบล่าสุด (แสดงผลแล้ว พ.ศ.) — null = ยังไม่เคยเบิก
  status: { label: string; tone: BadgeTone }; // สถานะของใบล่าสุด = สีการ์ด
  href: string | null;
  action: { kind: "create" | "continue" | "view"; label: string } | null;
  link: { href: string; label: string; kind: "view" | "create" } | null;
  search: string; // ข้อความที่ใช้ค้นหา (ชื่อ / รหัส / หมายเลขบริการ / เบอร์)
};

// ไอคอนศูนย์/เบอร์ในวงสีตามสถานะของใบล่าสุด
const ICON_TONE: Record<BadgeTone, string> = {
  red: "bg-red-100 text-red-600",
  amber: "bg-amber-100 text-amber-600",
  green: "bg-emerald-100 text-emerald-600",
  sky: "bg-sky-100 text-sky-600",
  violet: "bg-violet-100 text-violet-600",
  zinc: "bg-slate-100 text-slate-500",
};

// ไม่สนตัวพิมพ์ ช่องว่าง และขีด (เบอร์โทร 097-337-8822 = 0973378822)
const normalize = (s: string) => s.toLowerCase().replace(/[\s-]/g, "");

const ACTION_ICON = { create: Plus, continue: Pencil, view: Eye };

function ActionIcon({ kind }: { kind: keyof typeof ACTION_ICON }) {
  const Icon = ACTION_ICON[kind];
  return <Icon className="size-4" aria-hidden />;
}

export function CenterCards({ cards, noun, emptyText }: { cards: CenterCard[]; noun: string; emptyText: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const shown = useMemo(() => {
    const q = normalize(query);
    return q ? cards.filter((c) => normalize(c.search).includes(q)) : cards;
  }, [cards, query]);

  // จอคอม: พร้อมพิมพ์ค้นหาทันที (มือถือไม่โฟกัส — คีย์บอร์ดจะเด้งบังการ์ด)
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) input.current?.focus();
  }, []);

  return (
    <>
      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // เหลือการ์ดเดียว → Enter เปิดได้เลย
              if (e.key === "Enter" && shown.length === 1 && shown[0].href) router.push(shown[0].href);
            }}
            placeholder={noun === "เบอร์" ? "ค้นหาเบอร์ / ผู้ใช้บริการ / รหัสลูกค้า" : "ค้นหาชื่อศูนย์ / รหัสลูกค้า / หมายเลขบริการ"}
            aria-label={`ค้นหา${noun}`}
            className={`${inputClass} pl-9`}
          />
        </div>
        {query && (
          <p className="mt-1.5 text-xs text-slate-500">
            พบ {shown.length} {noun}
            {shown.length === 1 && shown[0].href && " — กด Enter เพื่อเปิด"}
          </p>
        )}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => (
          <li
            key={c.id}
            className={cx(
              "group relative flex flex-col rounded-2xl border border-l-4 p-4 shadow-sm transition",
              TONE_SURFACE[c.status.tone],
              c.href && "hover:-translate-y-0.5 hover:shadow-md",
            )}
          >
            <div className="flex items-start gap-3">
              <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-xl", ICON_TONE[c.status.tone])} aria-hidden>
                {c.phone ? <Smartphone className="size-5" /> : <Building className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                {c.href ? (
                  // ทั้งการ์ดกดได้ (after:inset-0) — ลิงก์ "ดูใบเบิก" ยกขึ้นด้านบนด้วย z-10
                  <Link href={c.href} className="font-semibold text-slate-900 after:absolute after:inset-0 after:rounded-xl group-hover:text-brand-700">
                    {c.name}
                  </Link>
                ) : (
                  <div className="font-semibold text-slate-900">{c.name}</div>
                )}
                <div className="mt-0.5 truncate text-xs tabular-nums text-slate-500">
                  {c.code} · {c.provider}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Badge tone={c.status.tone}>{c.status.label}</Badge>
            </div>

            <div className="mt-3 flex items-end justify-between gap-3 rounded-xl bg-slate-900/5 px-3 py-2.5 text-sm">
              <div className="text-slate-600">
                <div className="text-xs text-slate-500">รอบบริการใบล่าสุด</div>
                <div className="mt-0.5">{c.latestPeriod ?? "–"}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">ยอดปกติ</div>
                <div className="font-semibold tabular-nums text-slate-900">{c.normalAmount}</div>
              </div>
            </div>

            {(c.action || c.link) && (
              <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                {c.link ? (
                  <Link href={c.link.href} className="relative z-10 inline-flex items-center gap-1 text-slate-600 hover:text-brand-700 hover:underline">
                    {c.link.kind === "create" ? <Plus className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />} {c.link.label}
                  </Link>
                ) : (
                  <span />
                )}
                {c.action && (
                  <span
                    className={cx(
                      "inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold transition-colors group-hover:bg-brand-700 group-hover:text-white",
                      // ใบที่ยังไม่ส่ง: ปุ่มเด่นกว่า (ต้องทำต่อ)
                      c.action.kind === "continue" ? "bg-brand-700 text-white" : "text-brand-700",
                    )}
                  >
                    <ActionIcon kind={c.action.kind} />
                    {c.action.label}
                    <ChevronRight className="size-4" aria-hidden />
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {shown.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-12 text-center text-sm text-slate-500">
          <span className="flex size-14 items-center justify-center rounded-full bg-slate-100">
            <Inbox className="size-7 text-slate-400" aria-hidden />
          </span>
          {query ? `ไม่พบ${noun}ที่ตรงกับ “${query}”` : emptyText}
        </div>
      )}
    </>
  );
}
