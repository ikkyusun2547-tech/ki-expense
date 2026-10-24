import { UserPlus } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { CreateUserForm } from "./CreateUserForm";

export default async function NewUserPage() {
  await requireRole("ADMIN");

  return (
    <>
      <PageHeader icon={UserPlus} title="เพิ่มผู้ใช้" description="ผู้ใช้จะตั้งรหัสผ่านใหม่เองตอนล็อกอินครั้งแรก" />
      <Card className="max-w-2xl">
        <CreateUserForm />
      </Card>
    </>
  );
}
