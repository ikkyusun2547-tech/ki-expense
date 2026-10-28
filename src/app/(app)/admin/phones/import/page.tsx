import { Upload } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { ImportForm } from "../../centers/import/ImportForm";

export default async function ImportPhonesPage() {
  await requireRole("ADMIN");

  return (
    <>
      <PageHeader icon={Upload} title="นำเข้าทะเบียนเบอร์โทรศัพท์" description="เพิ่มหลายเบอร์พร้อมประวัติย้อนหลังจากตารางรายปี (Excel) หรือไฟล์ CSV" />
      <Card className="max-w-4xl">
        <ImportForm kind="PHONE" />
      </Card>
    </>
  );
}
