"use client";

import { Trash } from "lucide-react";
import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { initialFormState } from "@/lib/formState";
import { deleteCenter } from "@/server/actions/centers";

export function DeleteCenterForm({ id, name }: { id: string; name: string }) {
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
        ลบศูนย์นี้
      </Button>
    </form>
  );
}
