import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { CreateUserForm } from "./CreateUserForm";

export default async function NewUserPage() {
  await requireRole("ADMIN");

  return (
    <>
      <PageHeader title="เพิ่มผู้ใช้" description="ระบบจะสร้างรหัสผ่านชั่วคราวให้ ส่งให้ผู้ใช้ไปตั้งรหัสใหม่เอง" />
      <Card className="max-w-2xl">
        <CreateUserForm />
      </Card>
    </>
  );
}
