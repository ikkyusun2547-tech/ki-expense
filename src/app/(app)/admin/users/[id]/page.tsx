import { ArrowRightLeft, KeyRound, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { TransferForm } from "@/components/TransferForm";
import { Alert, Card, CardTitle, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { openRequestsWhere } from "@/server/services/requests";
import { EditUserForm } from "./EditUserForm";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function EditUserPage({ params, searchParams }: PageProps<"/admin/users/[id]">) {
  const admin = await requireRole("ADMIN");

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();

  const isSelf = user.id === admin.id;

  // ใบเบิกที่ยังไม่จ่ายของผู้ใช้คนนี้ — แก้/ลบ/ส่งได้เฉพาะเจ้าของ จึงต้องโอนก่อนปิดบัญชี/ย้ายงาน
  const [openRequests, creators] = await Promise.all([
    db.request.count({ where: openRequestsWhere(user.id) }),
    db.user.findMany({
      where: { role: "CREATOR", active: true, id: { not: user.id } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const sp = await searchParams;
  const transferred = typeof sp.transferred === "string" ? Number(sp.transferred) : null;
  const failed = typeof sp.fail === "string" ? Number(sp.fail) : 0;

  return (
    <>
      <PageHeader icon={Users} title={`แก้ไขผู้ใช้ ${user.name}`} description={`ชื่อผู้ใช้ ${user.username}`} />
      <div className="flex max-w-2xl flex-col gap-6">
        {transferred !== null && (
          <Alert tone={failed ? "warning" : "success"}>
            โอนใบเบิกแล้ว {transferred} ใบ{failed > 0 && ` — โอนไม่ได้ ${failed} ใบ (สถานะเปลี่ยนระหว่างนี้ ลองอีกครั้ง)`}
          </Alert>
        )}
        <Card>
          <EditUserForm
            isSelf={isSelf}
            user={{
              id: user.id,
              username: user.username,
              name: user.name,
              title: user.title ?? "",
              email: user.email ?? "",
              role: user.role,
              active: String(user.active),
            }}
          />
        </Card>
        {openRequests > 0 && (
          <Card>
            <CardTitle icon={ArrowRightLeft}>โอนใบเบิกที่ยังไม่จ่าย ({openRequests} ใบ)</CardTitle>
            <p className="mb-3 text-sm text-slate-600">
              ใบเบิกแก้ไข/ลบ/ส่งขออนุมัติได้เฉพาะผู้สร้าง — ถ้า {user.name} ลาออกหรือย้ายงาน ให้โอนใบที่ค้างอยู่ให้ผู้จัดทำคนอื่น
            </p>
            <TransferForm
              target={{ fromUserId: user.id }}
              creators={creators}
              confirmText={`โอนใบเบิกที่ยังไม่จ่ายทั้งหมด ${openRequests} ใบของ ${user.name} ให้ผู้จัดทำที่เลือก?`}
            />
          </Card>
        )}
        {!isSelf && (
          <Card>
            <CardTitle icon={KeyRound}>ตั้งรหัสผ่านใหม่</CardTitle>
            <ResetPasswordForm id={user.id} username={user.username} />
          </Card>
        )}
      </div>
    </>
  );
}
