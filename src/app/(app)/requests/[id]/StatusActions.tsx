"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { changeRequestStatus } from "@/server/actions/requests";

const CONFIRM: Record<"SEND" | "DELETE", string> = {
  SEND: 'ยืนยันว่าส่งใบเบิกที่เซ็นแล้วให้ฝ่ายบัญชี? หลังจากนี้จะแก้ไขไม่ได้',
  DELETE: "ลบใบเบิกนี้? (ระบบเก็บประวัติไว้ และศูนย์นี้จะสร้างใบเบิกรอบเดียวกันใหม่ได้)",
};

export function StatusActions({
  id,
  canSend,
  canDelete,
  canRevert,
}: {
  id: string;
  canSend: boolean;
  canDelete: boolean;
  canRevert: boolean;
}) {
  const [state, action, pending] = useActionState(changeRequestStatus, initialFormState);
  const [showRevert, setShowRevert] = useState(false);

  const confirmFor = (kind: "SEND" | "DELETE") => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!confirm(CONFIRM[kind])) e.preventDefault();
  };

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      {state.error && <Alert tone="error">{state.error}</Alert>}

      {canSend && (
        <Button type="submit" name="action" value="SEND" onClick={confirmFor("SEND")} disabled={pending}>
          ส่งบัญชีแล้ว
        </Button>
      )}

      {canRevert &&
        (showRevert ? (
          <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
            <Field label="เหตุผลที่ย้อนสถานะ" htmlFor="note">
              <textarea id="note" name="note" required rows={2} className={inputClass} />
            </Field>
            <Button type="submit" name="action" value="REVERT" variant="secondary" disabled={pending}>
              ย้อนเป็น &quot;สร้างแล้ว&quot;
            </Button>
          </div>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setShowRevert(true)}>
            ย้อนสถานะ…
          </Button>
        ))}

      {canDelete && (
        <Button type="submit" name="action" value="DELETE" variant="danger" onClick={confirmFor("DELETE")} disabled={pending}>
          ลบใบเบิก
        </Button>
      )}
    </form>
  );
}
