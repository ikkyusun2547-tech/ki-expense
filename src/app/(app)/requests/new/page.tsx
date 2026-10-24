import { FilePlus } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { signerFormProps } from "@/server/services/approvers";
import { RequestForm } from "../RequestForm";

export default async function NewRequestPage({ searchParams }: PageProps<"/requests/new">) {
  const user = await requireRole("CREATOR");
  const { code } = await searchParams;
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, name: true, title: true } });
  const signers = await signerFormProps(me);

  return (
    <>
      <PageHeader icon={FilePlus} title="สร้างใบเบิก" description="ใส่เลขที่ใบแจ้งหนี้ + แนบไฟล์ ที่เหลือระบบกรอกให้" />
      <Card className="max-w-3xl">
        <RequestForm
          mode="create"
          initialCode={typeof code === "string" ? code : undefined}
          {...signers}
        />
      </Card>
    </>
  );
}
