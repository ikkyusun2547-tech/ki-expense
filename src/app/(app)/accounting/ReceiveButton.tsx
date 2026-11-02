"use client";

import { Inbox } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { receiveDocument } from "@/server/actions/accounting";

// ฝ่ายบัญชีกด "รับเอกสาร" เมื่อได้รับใบเบิกกระดาษที่อนุมัติแล้ว (ทีละใบ — ไม่มีช่องติ๊กหลายใบ)
export function ReceiveButton({ id, returnTo, full = false }: { id: string; returnTo: "list" | "detail"; full?: boolean }) {
  const [state, action, pending] = useActionState(receiveDocument, initialFormState);
  return (
    <form action={action} className={full ? "flex flex-col gap-2" : "inline-flex flex-col items-start gap-1"}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Button type="submit" icon={Inbox} size={full ? "md" : "sm"} disabled={pending}>
        {pending ? "กำลังบันทึก…" : "รับเอกสาร"}
      </Button>
      {state.error && <span className="max-w-64 text-xs text-red-700">{state.error}</span>}
    </form>
  );
}
