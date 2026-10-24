"use client";

import { Stamp } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { changeRequestStatus } from "@/server/actions/requests";

// อนุมัติจากหน้ารายการได้เลย (ไม่ต้องเปิดหน้าใบเบิก) — ไม่อนุมัติต้องเปิดหน้าใบเบิกเพื่อใส่เหตุผล
export function ApproveButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(changeRequestStatus, initialFormState);

  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" name="action" value="APPROVE" size="sm" icon={Stamp} disabled={pending} className="w-28">
        {pending ? "กำลังอนุมัติ…" : "อนุมัติ"}
      </Button>
      {state.error && <span className="max-w-48 text-right text-xs text-red-700">{state.error}</span>}
    </form>
  );
}
