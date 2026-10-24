import { Plus, Users } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { Alert, Badge, ButtonLink, cx, PageHeader, RowLink, rowClass, TableCard, tableClass, tdClass, thClass } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/status";
import { nameInitial } from "@/lib/thai/name";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";

const ROLE_AVATAR: Record<Role, string> = {
  CREATOR: "bg-sky-100 text-sky-800",
  ACCOUNTING: "bg-amber-100 text-amber-800",
  APPROVER: "bg-violet-100 text-violet-800",
  ADMIN: "bg-emerald-100 text-emerald-800",
};

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const admin = await requireRole("ADMIN");
  const { created } = await searchParams;

  const users = await db.user.findMany({ orderBy: [{ active: "desc" }, { username: "asc" }] });

  return (
    <>
      <PageHeader
        icon={Users}
        title="ผู้ใช้"
        description="บัญชีของผู้จัดทำ ผู้อนุมัติ และฝ่ายบัญชี"
        actions={
          <ButtonLink href="/admin/users/new" icon={Plus}>
            เพิ่มผู้ใช้
          </ButtonLink>
        }
      />

      {typeof created === "string" && (
        <div className="mb-4">
          <Alert tone="success">
            สร้างบัญชี <span className="font-semibold">{created}</span> แล้ว — แจ้งชื่อผู้ใช้และรหัสผ่านเริ่มต้นให้เจ้าของบัญชี
          </Alert>
        </div>
      )}

      <TableCard>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>ผู้ใช้</th>
              <th className={thClass}>อีเมล</th>
              <th className={thClass}>บทบาท</th>
              <th className={thClass}>สถานะ</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={cx(rowClass, !u.active && "opacity-60")}>
                <td className={tdClass}>
                  <div className="flex items-center gap-3">
                    <span
                      className={cx("flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold", ROLE_AVATAR[u.role])}
                      aria-hidden
                    >
                      {nameInitial(u.name)}
                    </span>
                    <div>
                      <div className="font-medium text-slate-900">
                        {u.name}
                        {u.id === admin.id && <span className="ml-2 text-xs font-normal text-slate-400">(คุณ)</span>}
                      </div>
                      <div className="text-xs text-slate-500">
                        <span className="tabular-nums text-slate-400">{u.username}</span>
                        {u.title && <> · {u.title}</>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className={tdClass}>{u.email ?? <span className="text-slate-300">–</span>}</td>
                <td className={tdClass}>{ROLE_LABEL[u.role]}</td>
                <td className={tdClass}>
                  {!u.active ? (
                    <Badge tone="zinc">ปิดใช้งาน</Badge>
                  ) : u.mustChangePassword ? (
                    <Badge tone="amber">รอตั้งรหัสใหม่</Badge>
                  ) : (
                    <Badge tone="green">ใช้งาน</Badge>
                  )}
                </td>
                <td className={`${tdClass} text-right`}>
                  <RowLink href={`/admin/users/${u.id}`}>แก้ไข</RowLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
