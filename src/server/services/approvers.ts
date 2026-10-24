import "server-only";
import { db } from "@/server/db";

export type ApproverOption = { id: string; name: string; title: string };

// ผู้อนุมัติที่เลือกได้ในฟอร์มใบเบิก = บัญชีบทบาทผู้อนุมัติที่ใช้งานอยู่
// keep = ผู้อนุมัติที่ใบนี้เลือกไว้เดิม (แสดงต่อแม้บัญชีถูกปิดไปแล้ว)
export async function approverOptions(keep?: { id: string; name: string; title: string } | null): Promise<ApproverOption[]> {
  const users = await db.user.findMany({
    where: { role: "APPROVER", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, title: true },
  });
  const options = users.map((u) => ({ id: u.id, name: u.name, title: u.title ?? "" }));
  if (keep && !options.some((o) => o.id === keep.id)) options.push({ ...keep, name: `${keep.name} (ปิดบัญชีแล้ว)` });
  return options;
}

// ผู้อนุมัติของใบเบิกล่าสุดที่ผู้จัดทำคนนี้สร้าง — ใช้เป็นค่าเริ่มต้นของใบใหม่ (ถ้ายังเลือกได้อยู่)
export async function lastApproverId(creatorId: string, options: ApproverOption[]): Promise<string> {
  const last = await db.request.findFirst({
    where: { createdById: creatorId, approverId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { approverId: true },
  });
  const id = last?.approverId ?? "";
  if (options.some((o) => o.id === id)) return id;
  return options.length === 1 ? options[0].id : "";
}
