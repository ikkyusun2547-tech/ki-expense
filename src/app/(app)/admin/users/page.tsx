import Link from "next/link";
import { Badge, ButtonLink, PageHeader, tableClass, tdClass, thClass } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/status";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";

export default async function UsersPage() {
  const admin = await requireRole("ADMIN");

  const users = await db.user.findMany({ orderBy: [{ active: "desc" }, { username: "asc" }] });

  return (
    <>
      <PageHeader
        title="ผู้ใช้"
        description="ผู้ใช้ล็อกอินด้วยชื่อผู้ใช้และรหัสผ่านที่ admin สร้างให้ และต้องเปลี่ยนรหัสเองตอนล็อกอินครั้งแรก"
        actions={<ButtonLink href="/admin/users/new">+ เพิ่มผู้ใช้</ButtonLink>}
      />

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>ชื่อผู้ใช้</th>
              <th className={thClass}>ชื่อ-นามสกุล</th>
              <th className={thClass}>อีเมล</th>
              <th className={thClass}>บทบาท</th>
              <th className={thClass}>สถานะ</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "hover:bg-zinc-50" : "text-zinc-400"}>
                <td className={`${tdClass} font-mono`}>
                  {u.username}
                  {u.id === admin.id && <span className="ml-2 text-xs text-zinc-400">(คุณ)</span>}
                </td>
                <td className={tdClass}>{u.name}</td>
                <td className={tdClass}>{u.email ?? "–"}</td>
                <td className={tdClass}>{ROLE_LABEL[u.role]}</td>
                <td className={tdClass}>
                  {!u.active ? (
                    <Badge tone="zinc">ปิดใช้งาน</Badge>
                  ) : u.mustChangePassword ? (
                    <Badge tone="amber">รอเปลี่ยนรหัส</Badge>
                  ) : (
                    <Badge tone="green">ใช้งาน</Badge>
                  )}
                </td>
                <td className={`${tdClass} text-right`}>
                  <Link href={`/admin/users/${u.id}`} className="text-emerald-700 hover:underline">
                    แก้ไข
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
