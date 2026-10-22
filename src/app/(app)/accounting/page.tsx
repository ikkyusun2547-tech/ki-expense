import { Alert, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";

// TODO(เฟส 5): รายการรอจ่าย + บันทึกการจ่าย + ตารางสรุปรายศูนย์
export default async function AccountingPage() {
  await requireRole("ACCOUNTING", "ADMIN");

  return (
    <>
      <PageHeader title="ฝ่ายบัญชี" />
      <Alert tone="info">หน้านี้จะทำในเฟส 5 (รายการที่ส่งบัญชี + บันทึกวันที่จ่าย + ตารางสรุปรายศูนย์)</Alert>
    </>
  );
}
