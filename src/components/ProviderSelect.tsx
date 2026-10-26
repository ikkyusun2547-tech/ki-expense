"use client";

import { useRef, useState } from "react";
import { inputClass, Select } from "@/components/ui";

const OTHER = "__other";

// ช่อง "ระบบ (ค่าย)": เลือกจากค่ายที่รู้จัก หรือ "อื่น ๆ (พิมพ์เอง)" แล้วมีช่องให้พิมพ์ (ผู้ใช้ขอ 2026-10-26)
// ค่าเดิมที่ไม่อยู่ในรายการ → เปิดมาเป็น "อื่น ๆ" พร้อมชื่อเดิมในช่องพิมพ์
// ส่งค่าในชื่อ name เดียว: เลือกจากรายการ = hidden input, อื่น ๆ = ช่องพิมพ์
export function ProviderSelect({
  id,
  name,
  options,
  defaultValue,
  invalid,
}: {
  id: string;
  name: string;
  options: string[];
  defaultValue: string;
  invalid?: boolean;
}) {
  const known = options.includes(defaultValue);
  const [choice, setChoice] = useState(known || !defaultValue ? defaultValue || options[0] : OTHER);
  const otherRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <Select
        id={id}
        value={choice}
        onChange={(e) => {
          setChoice(e.target.value);
          if (e.target.value === OTHER) requestAnimationFrame(() => otherRef.current?.focus());
        }}
        aria-invalid={invalid}
      >
        {options.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
        <option value={OTHER}>อื่น ๆ (พิมพ์เอง)</option>
      </Select>
      {choice === OTHER ? (
        <input
          key="other"
          ref={otherRef}
          name={name}
          defaultValue={known ? "" : defaultValue}
          required
          maxLength={30}
          placeholder="พิมพ์ชื่อค่าย"
          aria-label="ชื่อค่าย (อื่น ๆ)"
          aria-invalid={invalid}
          className={inputClass}
        />
      ) : (
        <input key="known" type="hidden" name={name} value={choice} />
      )}
    </div>
  );
}
