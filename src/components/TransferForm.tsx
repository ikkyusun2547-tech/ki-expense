"use client";

import { ArrowRightLeft } from "lucide-react";
import { useActionState } from "react";
import { Alert, Button, Field, Select } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { transferRequestOwner, transferUserRequests } from "@/server/actions/requests";

// admin โอนใบเบิกให้ผู้จัดทำคนอื่น — ใบเดียว (หน้าใบเบิก) หรือทุกใบที่ยังไม่จ่ายของผู้ใช้คนหนึ่ง (หน้าแก้ไขผู้ใช้)
// แก้/ลบ/ส่งขออนุมัติได้เฉพาะเจ้าของใบ จึงต้องโอนเมื่อเจ้าของลา/ลาออก
export function TransferForm({
  target,
  creators,
  confirmText,
}: {
  target: { requestId: string } | { fromUserId: string };
  creators: { id: string; name: string }[]; // ผู้จัดทำที่ใช้งานอยู่ (ไม่รวมเจ้าของปัจจุบัน)
  confirmText: string;
}) {
  const [state, action, pending] = useActionState("requestId" in target ? transferRequestOwner : transferUserRequests, initialFormState);

  if (creators.length === 0) return <p className="text-sm text-slate-500">ยังไม่มีผู้จัดทำคนอื่นที่ใช้งานอยู่</p>;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      {"requestId" in target ? (
        <input type="hidden" name="id" value={target.requestId} />
      ) : (
        <input type="hidden" name="fromUserId" value={target.fromUserId} />
      )}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="โอนให้" htmlFor="toUserId">
        <Select id="toUserId" name="toUserId" required defaultValue="" className="w-full sm:max-w-xs">
          <option value="" disabled>
            เลือกผู้จัดทำ
          </option>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <div>
        <Button type="submit" variant="secondary" icon={ArrowRightLeft} disabled={pending}>
          โอนใบเบิก
        </Button>
      </div>
    </form>
  );
}
