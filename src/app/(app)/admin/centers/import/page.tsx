import { Upload } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { ImportForm } from "./ImportForm";

export default async function ImportCentersPage() {
  await requireRole("ADMIN");

  return (
    <>
      <PageHeader icon={Upload} title="นำเข้าทะเบียนศูนย์" description="เพิ่มหลายศูนย์พร้อมประวัติย้อนหลังจากตารางรายปี (Excel) หรือไฟล์ CSV" />
      <Card className="max-w-4xl">
        <ImportForm />
      </Card>
    </>
  );
}
