import { Pencil } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { canPerform } from "@/lib/status";
import { toISODate } from "@/lib/thai/date";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { approverOptions } from "@/server/services/approvers";
import { RequestForm } from "../../RequestForm";

export default async function EditRequestPage({ params }: PageProps<"/requests/[id]/edit">) {
  const user = await requireRole("CREATOR");

  const { id } = await params;
  const request = await db.request.findUnique({ where: { id }, include: { center: true } });
  if (!request || request.deletedAt) notFound();
  if (!canPerform(user.role, "EDIT", request.status)) redirect(`/requests/${id}`);

  const { center } = request;
  const approvers = await approverOptions(
    request.approverId ? { id: request.approverId, name: request.approverName ?? "", title: request.approverTitle ?? "" } : null,
  );

  return (
    <>
      <PageHeader
        icon={Pencil}
        title="แก้ไขใบเบิก"
        description='แก้ได้เฉพาะใบเบิกสถานะ "สร้างแล้ว" · เปลี่ยนศูนย์ไม่ได้ ถ้าเลือกศูนย์ผิดให้ลบแล้วสร้างใหม่'
      />
      <Card className="max-w-3xl">
        <RequestForm
          mode="edit"
          id={request.id}
          existingFileName={request.invoiceFileName}
          approvers={approvers}
          approverId={request.approverId ?? ""}
          center={{
            id: center.id,
            customerCode: center.customerCode,
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
