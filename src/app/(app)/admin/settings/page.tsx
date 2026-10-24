import { FileText, Settings } from "lucide-react";
import { Alert, Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { getReportSettings } from "@/server/services/reportSettings";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  await requireRole("ADMIN");
  const settings = await getReportSettings();

  return (
    <>
      <PageHeader
        icon={Settings}
        title="ตั้งค่าใบเบิก"
        description='ข้อความบนบันทึกภายใน (FM-50000-02) ที่พิมพ์จากปุ่ม "พิมพ์ใบเบิก" — เปลี่ยนคนหรือตำแหน่งแก้ที่นี่ได้เลย'
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SettingsForm settings={settings} />
        </Card>
        <div className="h-fit">
          <Alert tone="info">
            <p className="mb-1 flex items-center gap-1.5 font-medium">
              <FileText className="size-4" aria-hidden /> ข้อมูลที่ระบบใส่ให้อัตโนมัติ
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>วันที่บันทึก = วันที่สร้างใบเบิก (พ.ศ.)</li>
              <li>เรื่อง / ผู้ใช้บริการ = ชื่อศูนย์</li>
              <li>รหัสลูกค้า ยอด กำหนดชำระ จากใบเบิก</li>
              <li>รอบค่าใช้บริการ = เดือนของวันครบกำหนดชำระ</li>
              <li>ยอดเป็นตัวหนังสือ</li>
              <li>ชื่อผู้ขออนุมัติ = ชื่อผู้จัดทำ</li>
            </ul>
          </Alert>
        </div>
      </div>
    </>
  );
}
