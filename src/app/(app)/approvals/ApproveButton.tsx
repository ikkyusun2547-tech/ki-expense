"use client";

import { CircleX, Stamp, X } from "lucide-react";
import { useActionState, useState } from "react";
import { Button, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { changeRequestStatus } from "@/server/actions/requests";

// อนุมัติ / ไม่อนุมัติ จากหน้ารายการได้เลย (ไม่ต้องเปิดหน้าใบเบิก)
// ไม่อนุมัติ → กางช่องเหตุผล (บังคับ) ในแถวนั้น แล้วยืนยัน
export function ApproveButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(changeRequestStatus, initialFormState);
  const [rejecting, setRejecting] = useState(false);

  return (
    <form action={action} className="inline-flex flex-col items-end gap-2">
      <input type="hidden" name="id" value={id} />
      {rejecting ? (
        <div className="flex w-64 flex-col gap-2 rounded-lg border border-red-200 bg-red-50/50 p-2 text-left">
          <textarea
            name="note"
            required
            autoFocus
            rows={2}
            placeholder="เหตุผลที่ไม่อนุมัติ (ผู้จัดทำจะเห็น)"
            aria-label="เหตุผลที่ไม่อนุมัติ"
            className={`${inputClass} h-auto py-2`}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" icon={X} onClick={() => setRejecting(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" name="action" value="REJECT" variant="danger" size="sm" icon={CircleX} disabled={pending}>
              {pending ? "กำลังบันทึก…" : "ยืนยันไม่อนุมัติ"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button type="button" variant="danger" size="sm" icon={CircleX} onClick={() => setRejecting(true)}>
            ไม่อนุมัติ
          </Button>
          <Button type="submit" name="action" value="APPROVE" size="sm" icon={Stamp} disabled={pending}>
            {pending ? "กำลังอนุมัติ…" : "อนุมัติ"}
          </Button>
        </div>
      )}
      {state.error && <span className="max-w-64 text-right text-xs text-red-700">{state.error}</span>}
    </form>
  );
}
