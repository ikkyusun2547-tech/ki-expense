import { Building } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { CenterForm } from "../CenterForm";

export default async function NewCenterPage() {
  await requireRole("ADMIN");

  return (
    <>
      <PageHeader icon={Building} title="เพิ่มศูนย์" description="ข้อมูลศูนย์ใช้ค้นหาตอนสร้างใบเบิก และใช้ตรวจยอดกับวันครบกำหนด" />
      <Card className="max-w-2xl">
        <CenterForm />
      </Card>
    </>
  );
}
