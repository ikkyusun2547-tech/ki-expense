import { Building, Trash } from "lucide-react";
import { notFound } from "next/navigation";
import { Alert, Card, CardTitle, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { CenterForm } from "../CenterForm";
import { DeleteCenterForm } from "../DeleteCenterForm";

export default async function EditCenterPage({ params }: PageProps<"/admin/centers/[id]">) {
  await requireRole("ADMIN");

  const { id } = await params;
  const center = await db.center.findFirst({
    where: { id, kind: "INTERNET" },
    include: { _count: { select: { requests: true } } },
  });
  if (!center) notFound();

  return (
    <>
      <PageHeader icon={Building} title={`แก้ไขศูนย์ ${center.name}`} description={`รหัสลูกค้า ${center.customerCode}`} />
      <div className="flex max-w-2xl flex-col gap-6">
        <Card>
          <CenterForm
            center={{
              id: center.id,
              customerCode: center.customerCode,
              serviceNumber: center.serviceNumber ?? "",
              name: center.name,
              normalAmount: center.normalAmount.toFixed(2),
              dueDay: String(center.dueDay),
              status: center.status,
            }}
          />
        </Card>

        <Card>
          <CardTitle icon={Trash}>ลบศูนย์</CardTitle>
          {center._count.requests > 0 ? (
            <Alert tone="info">
              ศูนย์นี้เคยมีใบเบิก {center._count.requests} ใบ จึงลบไม่ได้ ถ้าศูนย์ย้ายหรือปิดแล้ว ให้เปลี่ยนสถานะด้านบนแทน
            </Alert>
          ) : (
            <DeleteCenterForm id={center.id} name={center.name} />
          )}
        </Card>
      </div>
    </>
  );
}
