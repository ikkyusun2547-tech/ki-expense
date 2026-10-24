import { Settings } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { getReportSettings } from "@/server/services/reportSettings";
import { SettingsForm } from "./SettingsForm";

// ผู้จัดทำดูแลข้อความบนใบเบิกเอง — เฉพาะผู้จัดทำ (ผู้ใช้เลือก 2026-10-24)
export default async function SettingsPage() {
  await requireRole("CREATOR");
  const settings = await getReportSettings();

  return (
    <>
      <PageHeader
        icon={Settings}
        title="ตั้งค่าใบเบิก"
        description="ข้อความคงที่บนใบเบิก (บันทึกภายใน FM-50000-02) ใช้ร่วมกันทุกใบ — ข้อมูลอื่นระบบใส่จากใบเบิกเอง ชื่อ/ตำแหน่งของแต่ละคนแจ้ง admin ให้แก้"
      />
      <Card className="max-w-3xl">
        <SettingsForm settings={settings} />
      </Card>
    </>
  );
}
