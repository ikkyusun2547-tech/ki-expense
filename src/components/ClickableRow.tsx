"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { cx } from "@/components/ui";

// แถวตารางที่กดตรงไหนก็เปิดหน้าของแถวนั้น (ใบเบิก / แก้ไขศูนย์ / แก้ไขผู้ใช้ ฯลฯ — ไปที่เดียวกับปุ่มในแถว)
// (ผู้ใช้ขอ 2026-10-27 — บางคนไม่รู้ว่ากดที่ชื่อได้)
// ยกเว้นเซลล์ที่มีช่องกรอก/ปุ่ม/ช่องติ๊ก ทั้งเซลล์ — กันกดพลาดข้างปุ่มแล้วเด้งไปหน้าอื่น
// คีย์บอร์ด/โปรแกรมอ่านจอใช้ลิงก์/ปุ่มในแถวตามเดิม
export function ClickableRow({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, label")) return;
    if (target.closest("td")?.querySelector("input, button, select, textarea")) return;
    if (window.getSelection()?.toString()) return; // กำลังลากเลือกข้อความ (เช่น คัดลอกเลขที่ใบแจ้งหนี้)
    if (e.ctrlKey || e.metaKey) window.open(href, "_blank");
    else router.push(href);
  }

  return (
    // พื้นเปลี่ยนสีชัดกว่าแถวทั่วไป (rowClass) ให้รู้ว่ากดได้
    <tr onClick={onClick} className={cx("group cursor-pointer transition-colors hover:bg-brand-50", className)}>
      {children}
    </tr>
  );
}
