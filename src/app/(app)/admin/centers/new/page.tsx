import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { CenterForm } from "../CenterForm";

export default async function NewCenterPage() {
  await requireRole("ADMIN");

  return (
    <>
      <PageHeader title="เพิ่มศูนย์" />
      <Card className="max-w-2xl">
        <CenterForm />
      </Card>
    </>
  );
}
