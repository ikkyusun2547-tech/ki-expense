"use client";

import { CalendarDays } from "lucide-react";
import { useRef, useState } from "react";
import { cx, inputClass } from "@/components/ui";
import { formatBEInput, maskBEInput, parseBEInput } from "@/lib/thai/date";

// ช่องวันที่แบบไทย วว/ดด/ปปปป (พ.ศ.) แทน <input type="date"> ที่แสดงตามภาษาเครื่อง (เช่น ดด/วว/ค.ศ.)
// - พิมพ์ตัวเลขล้วน ระบบใส่ / ให้เอง; ปุ่มปฏิทินเปิดตัวเลือกวันที่ของเบราว์เซอร์
// - ส่งค่าไปกับฟอร์มเป็น ISO (ค.ศ.) ผ่าน hidden input ชื่อ name — ฝั่งเซิร์ฟเวอร์ไม่ต้องเปลี่ยน
// - ใช้ได้ทั้งแบบควบคุม (value + onChange) และไม่ควบคุม (defaultValue)
type Props = {
  id: string;
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  required?: boolean;
  max?: string;
  invalid?: boolean;
};

export function ThaiDateInput({ id, name, value, defaultValue = "", onChange, required, max, invalid }: Props) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [iso, setIso] = useState(value ?? defaultValue);
  const [text, setText] = useState(formatBEInput(value ?? defaultValue));
  const [touched, setTouched] = useState(false);

  // ค่าจากภายนอกเปลี่ยน (เช่น กรอกให้ล่วงหน้า) → แสดงตาม (ปรับ state ระหว่าง render ตามแนวทางของ React)
  if (value !== undefined && value !== iso) {
    setIso(value);
    setText(formatBEInput(value));
  }

  const commit = (next: string) => {
    setIso(next);
    onChange?.(next);
  };

  const wrong = touched && text !== "" && parseBEInput(text) === null;

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          value={text}
          onChange={(e) => {
            const masked = maskBEInput(e.target.value);
            setText(masked);
            commit(parseBEInput(masked) ?? "");
          }}
          onBlur={() => setTouched(true)}
          inputMode="numeric"
          placeholder="วว/ดด/ปปปป (พ.ศ.)"
          required={required}
          aria-invalid={invalid || wrong}
          className={cx(inputClass, "pr-10 tabular-nums")}
        />
        <button
          type="button"
          onClick={() => pickerRef.current?.showPicker()}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-slate-400 hover:text-brand-700"
          aria-label="เลือกจากปฏิทิน"
          tabIndex={-1}
        >
          <CalendarDays className="size-4" aria-hidden />
        </button>
        {/* ปฏิทินของเบราว์เซอร์ (ซ่อนไว้ เปิดด้วยปุ่มด้านบน) */}
        <input
          ref={pickerRef}
          type="date"
          value={iso}
          max={max}
          onChange={(e) => {
            setText(formatBEInput(e.target.value));
            commit(e.target.value);
          }}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 size-0 opacity-0"
        />
      </div>
      <input type="hidden" name={name} value={iso} />
      {wrong && <p className="mt-1 text-xs text-red-700">วันที่ไม่ถูกต้อง — พิมพ์แบบ วว/ดด/ปปปป เช่น 04/10/2569</p>}
    </div>
  );
}
