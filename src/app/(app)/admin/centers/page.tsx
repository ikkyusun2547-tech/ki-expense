import Link from "next/link";
import type { CenterStatus } from "@/generated/prisma/enums";
import { CenterStatusBadge } from "@/components/StatusBadge";
import { ButtonLink, Button, inputClass, PageHeader, tableClass, tdClass, thClass } from "@/components/ui";
import { formatAmount } from "@/lib/money";
import { CENTER_STATUS_LABEL } from "@/lib/status";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";

const STATUSES = Object.keys(CENTER_STATUS_LABEL) as CenterStatus[];

export default async function CentersPage({ searchParams }: PageProps<"/admin/centers">) {
  await requireRole("ADMIN");

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = STATUSES.find((s) => s === params.status);

  const [centers, counts] = await Promise.all([
    db.center.findMany({
      where: {
        ...(status && { status }),
        ...(q && {
          OR: [
            { customerCode: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { serviceNumber: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { customerCode: "asc" },
      include: { _count: { select: { requests: true } } },
    }),
    db.center.groupBy({ by: ["status"], _count: true }),
  ]);

  const total = counts.reduce((sum, c) => sum + c._count, 0);
  const countOf = (s: CenterStatus) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageHeader
        title="ทะเบียนศูนย์"
        description={`ทั้งหมด ${total} ศูนย์ · ${STATUSES.map((s) => `${CENTER_STATUS_LABEL[s]} ${countOf(s)}`).join(" · ")}`}
        actions={<ButtonLink href="/admin/centers/new">+ เพิ่มศูนย์</ButtonLink>}
      />

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นหารหัสลูกค้า / ชื่อศูนย์ / หมายเลขบริการ"
          aria-label="ค้นหา"
          className={`${inputClass} max-w-sm`}
        />
        <select name="status" defaultValue={status ?? ""} aria-label="สถานะ" className={`${inputClass} w-auto`}>
          <option value="">ทุกสถานะ</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {CENTER_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          ค้นหา
        </Button>
        {(q || status) && (
          <ButtonLink href="/admin/centers" variant="ghost">
            ล้าง
          </ButtonLink>
        )}
      </form>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>รหัสลูกค้า</th>
              <th className={thClass}>ชื่อศูนย์</th>
              <th className={thClass}>หมายเลขบริการ</th>
              <th className={`${thClass} text-right`}>ยอดปกติ (บาท)</th>
              <th className={`${thClass} text-center`}>ครบกำหนดทุกวันที่</th>
              <th className={thClass}>สถานะ</th>
              <th className={`${thClass} text-right`}>ใบเบิก</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {centers.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-50">
                <td className={`${tdClass} font-mono`}>{c.customerCode}</td>
                <td className={tdClass}>{c.name}</td>
                <td className={`${tdClass} font-mono text-zinc-600`}>{c.serviceNumber ?? "–"}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatAmount(c.normalAmount)}</td>
                <td className={`${tdClass} text-center tabular-nums`}>{c.dueDay}</td>
                <td className={tdClass}>
                  <CenterStatusBadge status={c.status} />
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>{c._count.requests}</td>
                <td className={`${tdClass} text-right`}>
                  <Link href={`/admin/centers/${c.id}`} className="text-emerald-700 hover:underline">
                    แก้ไข
                  </Link>
                </td>
              </tr>
            ))}
            {centers.length === 0 && (
              <tr>
                <td colSpan={8} className={`${tdClass} py-8 text-center text-zinc-500`}>
                  {q || status ? "ไม่พบศูนย์ที่ตรงกับการค้นหา" : "ยังไม่มีศูนย์ในทะเบียน"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
