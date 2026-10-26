import { Smartphone, Trash } from "lucide-react";
import { notFound } from "next/navigation";
import { Alert, Card, CardTitle, PageHeader } from "@/components/ui";
import { formatPhone } from "@/lib/centers/phone";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { DeleteCenterForm } from "../../centers/DeleteCenterForm";
import { PhoneForm } from "../PhoneForm";

export default async function EditPhonePage({ params }: PageProps<"/admin/phones/[id]">) {
  await requireRole("ADMIN");

  const { id } = await params;
  const phone = await db.center.findFirst({
    where: { id, kind: "PHONE" },
    include: { _count: { select: { requests: true } } },
  });
  if (!phone) notFound();

  const number = formatPhone(phone.customerCode);

  return (
    <>
      <PageHeader icon={Smartphone} title={`แก้ไขเบอร์ ${number}`} description={`ผู้ใช้บริการ ${phone.name}`} />
      <div className="flex max-w-2xl flex-col gap-6">
        <Card>
          <PhoneForm
            phone={{
              id: phone.id,
              phoneNumber: number,
              provider: phone.provider,
              accountCode: phone.serviceNumber ?? "",
              name: phone.name,
              normalAmount: phone.normalAmount.toFixed(2),
              dueDay: String(phone.dueDay),
              status: phone.status,
            }}
          />
        </Card>

        <Card>
          <CardTitle icon={Trash}>ลบเบอร์</CardTitle>
          {phone._count.requests > 0 ? (
            <Alert tone="info">
              เบอร์นี้เคยมีใบเบิก {phone._count.requests} ใบ จึงลบไม่ได้ ถ้ายกเลิกเบอร์แล้ว ให้เปลี่ยนสถานะด้านบนเป็น &quot;ยกเลิก&quot; แทน
            </Alert>
          ) : (
            <DeleteCenterForm id={phone.id} name={number} label="ลบเบอร์นี้" />
          )}
        </Card>
      </div>
    </>
  );
}
