import { Smartphone } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { PhoneForm } from "../PhoneForm";

export default async function NewPhonePage() {
  await requireRole("ADMIN");

  return (
    <>
      <PageHeader
        icon={Smartphone}
        title="เพิ่มเบอร์โทรศัพท์"
        description="ข้อมูลเบอร์ใช้ค้นหาตอนสร้างใบเบิกค่าโทรศัพท์ และใช้ตรวจยอดกับวันครบกำหนด"
      />
      <Card className="max-w-2xl">
        <PhoneForm />
      </Card>
    </>
  );
}
