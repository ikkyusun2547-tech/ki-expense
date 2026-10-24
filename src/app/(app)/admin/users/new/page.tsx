import { UserPlus } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { CreateUserForm } from "./CreateUserForm";

export default async function NewUserPage() {
  await requireRole("ADMIN");

  return (
    <>
      <PageHeader icon={UserPlus} title="เพิ่มผู้ใช้" description="เลือกบทบาท กรอกข้อมูล และตั้งรหัสผ่านเริ่มต้น — ผู้ใช้ต้องตั้งรหัสใหม่เองตอนล็อกอินครั้งแรก" />
      <Card className="max-w-2xl">
        <CreateUserForm />
      </Card>
    </>
  );
}
