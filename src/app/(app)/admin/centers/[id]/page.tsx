import { notFound } from "next/navigation";
import { Alert, Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { CenterForm } from "../CenterForm";
import { DeleteCenterForm } from "../DeleteCenterForm";

export default async function EditCenterPage({ params }: PageProps<"/admin/centers/[id]">) {
  await requireRole("ADMIN");

  const { id } = await params;
  const center = await db.center.findUnique({
    where: { id },
    include: { _count: { select: { requests: true } } },
  });
  if (!center) notFound();

  return (
    <>
      <PageHeader title={`แก้ไขศูนย์ ${center.name}`} />
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
          <h2 className="mb-3 font-medium text-zinc-900">ลบศูนย์</h2>
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
