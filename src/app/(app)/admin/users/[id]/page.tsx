import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { EditUserForm } from "./EditUserForm";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function EditUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const admin = await requireRole("ADMIN");

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();

  const isSelf = user.id === admin.id;

  return (
    <>
      <PageHeader title={`แก้ไขผู้ใช้ ${user.username}`} />
      <div className="flex max-w-2xl flex-col gap-6">
        <Card>
          <EditUserForm
            isSelf={isSelf}
            user={{
              id: user.id,
              name: user.name,
              email: user.email ?? "",
              role: user.role,
              active: String(user.active),
            }}
          />
        </Card>
        {!isSelf && (
          <Card>
            <h2 className="mb-3 font-medium text-zinc-900">รีเซ็ตรหัสผ่าน</h2>
            <ResetPasswordForm id={user.id} username={user.username} />
          </Card>
        )}
      </div>
    </>
  );
}
