import { KeyRound, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { Card, CardTitle, PageHeader } from "@/components/ui";
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
      <PageHeader icon={Users} title={`แก้ไขผู้ใช้ ${user.name}`} description={`ชื่อผู้ใช้ ${user.username}`} />
      <div className="flex max-w-2xl flex-col gap-6">
        <Card>
          <EditUserForm
            isSelf={isSelf}
            user={{
              id: user.id,
              username: user.username,
              name: user.name,
              title: user.title ?? "",
              email: user.email ?? "",
              role: user.role,
              active: String(user.active),
            }}
          />
        </Card>
        {!isSelf && (
          <Card>
            <CardTitle icon={KeyRound}>ตั้งรหัสผ่านใหม่</CardTitle>
            <ResetPasswordForm id={user.id} username={user.username} />
          </Card>
        )}
      </div>
    </>
  );
}
