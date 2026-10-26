"use client";

import { Trash } from "lucide-react";
import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { deleteCenter } from "@/server/actions/centers";

// ใช้ทั้งทะเบียนศูนย์และทะเบียนเบอร์โทรศัพท์ (deleteCenter พากลับหน้าทะเบียนตามประเภทเอง)
export function DeleteCenterForm({ id, name, label = "ลบศูนย์นี้" }: { id: string; name: string; label?: string }) {
  const [state, action, pending] = useActionState(deleteCenter, initialFormState);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`ลบ "${name}" ออกจากทะเบียน?`)) e.preventDefault();
      }}
      className="flex flex-col items-start gap-3"
    >
      <input type="hidden" name="id" value={id} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" variant="danger" icon={Trash} disabled={pending}>
        {label}
      </Button>
    </form>
  );
}
