import { ClickableRow } from "@/components/ClickableRow";
import { CircleCheck, CircleX, Inbox, Pencil, Plus, Search, Smartphone, Upload, X } from "lucide-react";
import { CenterStatusBadge } from "@/components/StatusBadge";
import {
  Button,
  ButtonLink,
  EmptyRow,
  FilterBar,
  FilterSelect,
  NameCell,
  PageHeader,
  RowLink,
  SearchInput,
  StatCard,
  TableCard,
  tableClass,
  tdClass,
  thClass,
  type BadgeTone,
  type IconType,
} from "@/components/ui";
import { formatPhone } from "@/lib/centers/phone";
import { formatAmount } from "@/lib/money";
import { PHONE_STATUS_LABEL } from "@/lib/status";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { AdminTabs } from "../AdminTabs";

// ทะเบียนเบอร์โทรศัพท์ = แถวในตาราง Center ที่ kind = PHONE (หมายเลข = customerCode, รหัสลูกค้าของค่าย = serviceNumber)

type PhoneStatus = keyof typeof PHONE_STATUS_LABEL;
const STATUSES = Object.keys(PHONE_STATUS_LABEL) as PhoneStatus[];

const STATUS_CARD: Record<PhoneStatus, { icon: IconType; tone: BadgeTone; sub: string }> = {
  ACTIVE: { icon: CircleCheck, tone: "green", sub: "เบิกได้ตามปกติ" },
  CLOSED: { icon: CircleX, tone: "zinc", sub: "เบิกไม่ได้" },
};

export default async function PhonesPage({ searchParams }: PageProps<"/admin/phones">) {
  await requireRole("ADMIN");

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const qDigits = q.replace(/[\s\-]/g, "");
  const status = STATUSES.find((s) => s === params.status);

  const [phones, counts] = await Promise.all([
    db.center.findMany({
      where: {
        kind: "PHONE",
        ...(status && { status }),
        ...(q && {
          OR: [
            ...(qDigits ? [{ customerCode: { contains: qDigits } }] : []),
            { name: { contains: q, mode: "insensitive" as const } },
            { serviceNumber: { contains: q, mode: "insensitive" as const } },
            { provider: { contains: q, mode: "insensitive" as const } },
          ],
        }),
      },
      orderBy: [{ name: "asc" }, { customerCode: "asc" }],
      include: { _count: { select: { requests: true } } },
    }),
    db.center.groupBy({ by: ["status"], where: { kind: "PHONE" }, _count: true }),
  ]);

  const total = counts.reduce((sum, c) => sum + c._count, 0);
  const countOf = (s: PhoneStatus) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <AdminTabs current="/admin/phones" />
      <PageHeader
        icon={Smartphone}
        title="ทะเบียนเบอร์โทรศัพท์"
        description={`ทั้งหมด ${total} เบอร์`}
        actions={
          <div className="flex gap-2">
            <ButtonLink href="/admin/phones/import" variant="secondary" icon={Upload}>
              นำเข้าจากไฟล์
            </ButtonLink>
            <ButtonLink href="/admin/phones/new" icon={Plus}>
              เพิ่มเบอร์
            </ButtonLink>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-xl sm:gap-4">
        {STATUSES.map((s) => (
          <StatCard
            key={s}
            label={PHONE_STATUS_LABEL[s]}
            value={countOf(s)}
            sub={STATUS_CARD[s].sub}
            icon={STATUS_CARD[s].icon}
            tone={STATUS_CARD[s].tone}
            href={status === s ? "/admin/phones" : `/admin/phones?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            active={status === s}
          />
        ))}
      </div>

      <FilterBar>
        <SearchInput defaultValue={q} placeholder="ค้นหาเบอร์ / ผู้ใช้บริการ / รหัสลูกค้า / ระบบ" />
        <FilterSelect
          name="status"
          label="สถานะ"
          defaultValue={status}
          options={[{ value: "", label: "ทุกสถานะ" }, ...STATUSES.map((s) => ({ value: s, label: PHONE_STATUS_LABEL[s] }))]}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" icon={Search} className="flex-1 sm:flex-none">
            ค้นหา
          </Button>
          {(q || status) && (
            <ButtonLink href="/admin/phones" variant="ghost" icon={X}>
              ล้างตัวกรอง
            </ButtonLink>
          )}
        </div>
      </FilterBar>

      <TableCard>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>เบอร์ / ผู้ใช้บริการ</th>
              <th className={thClass}>ระบบ</th>
              <th className={thClass}>รหัสลูกค้า</th>
              <th className={`${thClass} text-right`}>ยอดปกติ (บาท)</th>
              <th className={`${thClass} text-center`}>ครบกำหนดทุกวันที่</th>
              <th className={thClass}>สถานะ</th>
              <th className={`${thClass} text-right`}>ใบเบิก</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {phones.map((p) => (
              <ClickableRow key={p.id} href={`/admin/phones/${p.id}`}>
                <td className={tdClass}>
                  <NameCell name={formatPhone(p.customerCode)} code={`ผู้ใช้: ${p.name}`} href={`/admin/phones/${p.id}`} />
                </td>
                <td className={tdClass}>{p.provider || "–"}</td>
                <td className={`${tdClass} tabular-nums text-slate-500`}>{p.serviceNumber ?? "–"}</td>
                <td className={`${tdClass} text-right font-semibold tabular-nums text-slate-900`}>{formatAmount(p.normalAmount)}</td>
                <td className={`${tdClass} text-center tabular-nums`}>{p.dueDay}</td>
                <td className={tdClass}>
                  <CenterStatusBadge status={p.status} kind="PHONE" />
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>{p._count.requests}</td>
                <td className={`${tdClass} text-right`}>
                  <RowLink href={`/admin/phones/${p.id}`} icon={Pencil}>แก้ไข</RowLink>
                </td>
              </ClickableRow>
            ))}
            {phones.length === 0 && (
              <EmptyRow colSpan={8} icon={Inbox}>
                {q || status ? "ไม่พบเบอร์ที่ตรงกับการค้นหา" : 'ยังไม่มีเบอร์ในทะเบียน — กด "เพิ่มเบอร์" หรือ "นำเข้าจากไฟล์" เพื่อเริ่ม'}
              </EmptyRow>
            )}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
