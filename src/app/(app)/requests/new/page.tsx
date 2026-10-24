import { FilePlus } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { approverOptions, lastApproverId } from "@/server/services/approvers";
import { RequestForm } from "../RequestForm";

export default async function NewRequestPage({ searchParams }: PageProps<"/requests/new">) {
  const user = await requireRole("CREATOR");
  const { code } = await searchParams;
  const approvers = await approverOptions();

  return (
    <>
      <PageHeader icon={FilePlus} title="สร้างใบเบิก" description="1 ใบเบิก = 1 ศูนย์ · ค้นหาศูนย์ → ตรวจข้อมูลที่กรอกให้ → ใส่เลขที่ใบแจ้งหนี้ + แนบไฟล์ → ส่งขออนุมัติ" />
      <Card className="max-w-3xl">
        <RequestForm
          mode="create"
          initialCode={typeof code === "string" ? code : undefined}
          approvers={approvers}
          approverId={await lastApproverId(user.id, approvers)}
        />
      </Card>
    </>
  );
}
