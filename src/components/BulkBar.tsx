"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Alert, Button, cx, type IconType } from "@/components/ui";
import { initialFormState, type FormState } from "@/lib/formState";

// แถบทำรายการทีละหลายใบ (อนุมัติ / บันทึกจ่าย)
// ช่องติ๊กอยู่ในแถวตาราง/การ์ด แต่ผูกกับฟอร์มนี้ด้วย attribute form={formId} — ซ้อน <form> ในตารางไม่ได้
// เพราะแต่ละแถวมีฟอร์มของตัวเองอยู่แล้ว
export function BulkBar({
  formId,
  action,
  submitLabel,
  icon,
  confirmText,
  children,
}: {
  formId: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  icon: IconType;
  confirmText: (count: number) => string;
  children?: (state: FormState) => ReactNode; // ช่องกรอกเพิ่ม (เช่น วันที่จ่าย/เลขอ้างอิง)
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [count, setCount] = useState(0);

  const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form="${formId}"]`));
  // นับเลขใบไม่ซ้ำ (จอเล็ก/ใหญ่มีช่องติ๊กของใบเดียวกันคนละชุด)
  const recount = () => setCount(new Set(boxes().filter((b) => b.checked).map((b) => b.value)).size);

  useEffect(() => {
    const onChange = (e: Event) => {
      if (e.target instanceof HTMLInputElement && e.target.getAttribute("form") === formId) recount();
    };
    // React ล้างฟอร์มหลังส่ง (ช่องติ๊กกลับเป็นว่าง) โดยไม่ยิง change → นับใหม่หลัง reset
    const onReset = (e: Event) => (e.target as HTMLElement).id === formId && setTimeout(recount);
    document.addEventListener("change", onChange);
    document.addEventListener("reset", onReset, true);
    return () => {
      document.removeEventListener("change", onChange);
      document.removeEventListener("reset", onReset, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  const toggleAll = () => {
    const all = boxes();
    const select = count === 0; // ตามป้ายปุ่ม: ยังไม่เลือก → เลือกทั้งหมด, เลือกแล้ว → ยกเลิกทั้งหมด
    for (const b of all) b.checked = select;
    recount();
  };

  return (
    <form
      id={formId}
      action={formAction}
      onSubmit={(e) => {
        if (count === 0 || !confirm(confirmText(count))) e.preventDefault();
      }}
      className={cx(
        "mb-4 flex flex-col gap-3 rounded-xl border p-3 shadow-sm",
        count > 0 ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white",
      )}
    >
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
          {count > 0 ? "ยกเลิกที่เลือก" : "เลือกทั้งหมด"}
        </Button>
        {/* ยังไม่ติ๊ก → บรรทัดเดียวบอกวิธีใช้; ติ๊กแล้ว → ช่องกรอก + ปุ่มบันทึก */}
        {count === 0 ? (
          <span className="self-center text-sm text-slate-500">หรือติ๊ก ☐ หน้าใบเบิกหลายใบ เพื่อทำพร้อมกันครั้งเดียว</span>
        ) : (
          <>
            <span className="self-center text-sm text-slate-600">
              เลือกแล้ว <span className="font-semibold tabular-nums text-slate-900">{count}</span> ใบ
            </span>
            {children?.(state)}
            <Button type="submit" icon={icon} disabled={pending} className="ml-auto">
              {pending ? "กำลังบันทึก…" : `${submitLabel} (${count})`}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}

// ช่องติ๊กในแถว — ผูกกับ BulkBar ที่ formId เดียวกัน
export function BulkCheckbox({ formId, id, label }: { formId: string; id: string; label: string }) {
  return (
    <input
      type="checkbox"
      form={formId}
      name="ids"
      value={id}
      aria-label={label}
      className="size-4 cursor-pointer rounded border-slate-300 accent-emerald-700"
    />
  );
}
