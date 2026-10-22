import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { RequestForm } from "../RequestForm";

export default async function NewRequestPage() {
  await requireRole("CREATOR");

  return (
    <>
      <PageHeader title="สร้างใบเบิก" description="1 ใบเบิก = 1 ศูนย์ · ค้นหาศูนย์จากรหัสลูกค้า แล้วกรอกข้อมูลตามใบแจ้งหนี้" />
      <Card className="max-w-3xl">
        <RequestForm mode="create" />
      </Card>
    </>
  );
}
