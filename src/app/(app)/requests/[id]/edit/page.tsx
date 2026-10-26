import { Pencil } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { canPerform } from "@/lib/status";
import { toISODate } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { signerFormProps } from "@/server/services/approvers";
import { RequestForm } from "../../RequestForm";

export default async function EditRequestPage({ params }: PageProps<"/requests/[id]/edit">) {
  const user = await requireRole("CREATOR");

  const { id } = await params;
  const request = await db.request.findUnique({
    where: { id },
    include: { center: true, createdBy: { select: { id: true, name: true, title: true } } },
  });
  if (!request || request.deletedAt) notFound();
  if (!canPerform(user.role, "EDIT", request.status)) redirect(`/requests/${id}`);

  const { center } = request;
  const signers = await signerFormProps(request.createdBy, request);

  return (
    <>
      <PageHeader
        icon={Pencil}
        title="แก้ไขใบเบิก"
        description="เปลี่ยนศูนย์/เบอร์ไม่ได้ — ถ้าเลือกผิดให้ลบแล้วสร้างใหม่"
      />
      <Card className="max-w-3xl">
        <RequestForm
          mode="edit"
          id={request.id}
          existingFileName={request.invoiceFileName}
          {...signers}
          center={{
            id: center.id,
            kind: center.kind,
            customerCode: center.customerCode,
            provider: center.provider,
            serviceNumber: center.serviceNumber,
            name: center.name,
            normalAmount: center.normalAmount.toFixed(2),
            dueDay: center.dueDay,
            status: center.status,
          }}
          values={{
            invoiceNo: request.invoiceNo,
            amount: request.amount.toFixed(2),
            periodStart: toISODate(request.periodStart),
            periodEnd: toISODate(request.periodEnd),
            dueDate: toISODate(request.dueDate),
          }}
        />
      </Card>
    </>
  );
}
