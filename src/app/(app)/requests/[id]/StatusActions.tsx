"use client";

import { CircleX, Send, Stamp, Trash, Undo2, X } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { changeRequestStatus } from "@/server/actions/requests";

type ConfirmKind = "SUBMIT" | "APPROVE" | "DELETE";

export function StatusActions({
  id,
  canSubmit,
  submitBlocked,
  approverName,
  canApprove,
  canDelete,
  deleteNeedsNote,
  canRevert,
}: {
  id: string;
  canSubmit: boolean;
  submitBlocked?: string; // เหตุผลที่ยังส่งขออนุมัติไม่ได้ (เช่น ยังไม่เลือกผู้อนุมัติ)
  approverName: string | null;
  canApprove: boolean; // ผู้ใช้คนนี้คือผู้อนุมัติของใบที่รออนุมัติ → อนุมัติ/ไม่อนุมัติได้
  canDelete: boolean;
  deleteNeedsNote?: boolean; // ใบย้อนหลังที่นำเข้าจากตารางเดิม — admin ลบได้ ต้องใส่เหตุผล
  canRevert: boolean;
}) {
  const [state, action, pending] = useActionState(changeRequestStatus, initialFormState);
  const [noteFor, setNoteFor] = useState<NoteKind | null>(null);

  const confirmText: Record<ConfirmKind, string> = {
    SUBMIT: `ส่งใบเบิกให้ ${approverName ?? "ผู้อนุมัติ"} อนุมัติ? หลังจากนี้จะแก้ไขไม่ได้`,
    APPROVE: "อนุมัติใบเบิกนี้? ใบเบิกจะส่งต่อให้ฝ่ายบัญชีทันที",
    DELETE: "ลบใบเบิกนี้? (ระบบเก็บประวัติไว้ และศูนย์นี้จะสร้างใบเบิกรอบเดียวกันใหม่ได้)",
  };
  const confirmFor = (kind: ConfirmKind) => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!confirm(confirmText[kind])) e.preventDefault();
  };

  if (!canSubmit && !canApprove && !canDelete && !canRevert && !state.error) return null;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      {state.error && <Alert tone="error">{state.error}</Alert>}

      {canSubmit && (
        <>
          <Button
            type="submit"
            name="action"
            value="SUBMIT"
            icon={Send}
            onClick={confirmFor("SUBMIT")}
            disabled={pending || !!submitBlocked}
          >
            ส่งขออนุมัติ
          </Button>
          {submitBlocked && <p className="-mt-1 text-xs text-amber-700">{submitBlocked}</p>}
        </>
      )}

      {/* ซ่อนปุ่มอนุมัติระหว่างกรอกเหตุผลไม่อนุมัติ (ช่องเหตุผลบังคับกรอก จะกันการกดอนุมัติ) */}
      {canApprove && !noteFor && (
        <Button type="submit" name="action" value="APPROVE" icon={Stamp} onClick={confirmFor("APPROVE")} disabled={pending}>
          อนุมัติ
        </Button>
      )}

      {noteFor ? (
        <NoteBox kind={noteFor} pending={pending} onCancel={() => setNoteFor(null)} />
      ) : (
        <>
          {canApprove && (
            <Button type="button" variant="danger" icon={CircleX} onClick={() => setNoteFor("REJECT")}>
              ไม่อนุมัติ
            </Button>
          )}
          {canRevert && (
            <Button type="button" variant="secondary" icon={Undo2} onClick={() => setNoteFor("REVERT")}>
              ย้อนสถานะ
            </Button>
          )}
        </>
      )}

      {canDelete && !noteFor && (
        deleteNeedsNote ? (
          <Button type="button" variant="danger" icon={Trash} onClick={() => setNoteFor("DELETE")}>
            ลบใบย้อนหลัง
          </Button>
        ) : (
          <Button type="submit" name="action" value="DELETE" variant="danger" icon={Trash} onClick={confirmFor("DELETE")} disabled={pending}>
            ลบใบเบิก
          </Button>
        )
      )}
    </form>
  );
}

type NoteKind = "REJECT" | "REVERT" | "DELETE";

const NOTE_BOX: Record<NoteKind, { label: string; hint: string; button: string; icon: typeof Trash; box: string }> = {
  REJECT: {
    label: "เหตุผลที่ไม่อนุมัติ",
    hint: "ผู้จัดทำจะเห็นเหตุผลนี้ แล้วแก้ไขส่งใหม่ได้",
    button: "ยืนยันไม่อนุมัติ",
    icon: CircleX,
    box: "border-red-200 bg-red-50/50",
  },
  REVERT: {
    label: "เหตุผลที่ย้อนสถานะ",
    hint: "ใบเบิกจะกลับเป็น “สร้างแล้ว” ผู้จัดทำจะเห็นเหตุผลนี้ในประวัติ",
    button: "ย้อนเป็น “สร้างแล้ว”",
    icon: Undo2,
    box: "border-orange-200 bg-orange-50/50",
  },
  DELETE: {
    label: "เหตุผลที่ลบใบย้อนหลัง",
    hint: "เช่น พิมพ์ยอดผิด — ลบแล้วแก้ไฟล์ Excel แล้วนำเข้าใหม่ได้ (ระบบเก็บประวัติการลบไว้)",
    button: "ยืนยันลบใบย้อนหลัง",
    icon: Trash,
    box: "border-red-200 bg-red-50/50",
  },
};

// ช่องกรอกเหตุผล (บังคับ) สำหรับไม่อนุมัติ / ย้อนสถานะ / ลบใบย้อนหลัง
function NoteBox({ kind, pending, onCancel }: { kind: NoteKind; pending: boolean; onCancel: () => void }) {
  const c = NOTE_BOX[kind];
  return (
    <div className={`flex flex-col gap-3 rounded-lg border p-3 ${c.box}`}>
      <Field label={c.label} htmlFor="note" hint={c.hint}>
        <textarea id="note" name="note" required rows={2} className={`${inputClass} h-auto py-2`} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" name="action" value={kind} variant={kind === "REVERT" ? "secondary" : "danger"} icon={c.icon} disabled={pending}>
          {c.button}
        </Button>
        <Button type="button" variant="secondary" icon={X} onClick={onCancel}>
          ยกเลิก
        </Button>
      </div>
    </div>
  );
}
