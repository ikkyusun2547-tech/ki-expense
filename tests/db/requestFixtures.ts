import type { CenterStatus, Role } from "@/generated/prisma/enums";
import { initialFormState } from "@/lib/formState";
import { login } from "@/server/actions/auth";
import { changeRequestSigners, changeRequestStatus, saveRequest } from "@/server/actions/requests";
import { db } from "@/server/db";
import { hashPassword } from "@/server/password";
import { form, PASSWORD, run } from "./helpers";
import { cookieJar } from "./setup";

// ตัวช่วยสำหรับ test ที่สร้างใบเบิก (มี ApprovalLog ซึ่งลบไม่ได้)
// แต่ละไฟล์ใช้ prefix ของตัวเอง; DB ทดสอบถูกล้างใหม่ทุกครั้งที่รัน จึงไม่ต้อง cleanup

export const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
export const pdfFile = (name = "ใบแจ้งหนี้.pdf") => new File([PDF], name, { type: "application/pdf" });

// ผู้ใช้ทดสอบ: บทบาทละ 1 คน + ผู้จัดทำ/ผู้อนุมัติคนที่สอง (ไว้ทดสอบการเลือกผู้ลงนาม)
const USERS: { key: string; role: Role; title?: string }[] = [
  { key: "creator", role: "CREATOR", title: "เจ้าหน้าที่ธุรการ" },
  { key: "creator2", role: "CREATOR", title: "เจ้าหน้าที่ GPS" },
  { key: "accounting", role: "ACCOUNTING" },
  { key: "approver", role: "APPROVER", title: "ผู้จัดการส่วน" },
  { key: "approver2", role: "APPROVER", title: "รักษาการผู้จัดการส่วน" },
  { key: "admin", role: "ADMIN" },
];

export type FixtureUser = "CREATOR" | "CREATOR2" | "ACCOUNTING" | "APPROVER" | "APPROVER2" | "ADMIN";

export function requestFixtures(prefix: string) {
  const P = `${prefix}${Date.now()}-`;
  let seq = 0;

  async function createUsers() {
    for (const u of USERS) {
      await db.user.create({
        data: {
          username: `${P}${u.key}`,
          name: `ทดสอบ ${u.key}`,
          title: u.title,
          role: u.role,
          passwordHash: await hashPassword(PASSWORD),
          mustChangePassword: false,
        },
      });
    }
  }

  async function loginAs(user: FixtureUser) {
    cookieJar.clear();
    await run(() => login(initialFormState, form({ username: `${P}${user.toLowerCase()}`, password: PASSWORD })));
  }

  const userId = async (user: FixtureUser) =>
    (await db.user.findUniqueOrThrow({ where: { username: `${P}${user.toLowerCase()}` } })).id;

  async function center(options: { status?: CenterStatus; dueDay?: number } = {}) {
    return db.center.create({
      data: {
        customerCode: `${P}C${++seq}`,
        name: `ศูนย์ทดสอบ ${seq}`,
        normalAmount: "749.00",
        dueDay: options.dueDay ?? 15,
        status: options.status ?? "ACTIVE",
      },
    });
  }

  // ใบเบิกปกติ (ไม่มีคำเตือน) ของรอบ ก.ย. 2569
  const valid = (centerId: string, extra: Record<string, string> = {}) => ({
    centerId,
    invoiceNo: "INV-001",
    amount: "749",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    dueDate: "2026-10-15",
    ...extra,
  });

  // file: ไม่ระบุ = แนบ PDF, null = ไม่แนบ
  const save = (values: Record<string, string>, file?: File | null) => {
    const fd = form(values);
    const attached = file === undefined ? pdfFile() : file;
    if (attached) fd.set("invoiceFile", attached);
    return run(() => saveRequest({}, fd));
  };

  const idFrom = (outcome: Awaited<ReturnType<typeof save>>) => {
    if (!("redirect" in outcome)) throw new Error(`expected redirect, got ${JSON.stringify(outcome)}`);
    return outcome.redirect.split("/").pop()!;
  };

  const status = (id: string, action: string, note = "") =>
    run(() => changeRequestStatus(initialFormState, form({ id, action, note })));

  // เลือกผู้ลงนาม: ค่าเป็น id ผู้ใช้ ("" = ค่าเริ่มต้น)
  const pickSigners = (id: string, requester: string, approver: string) =>
    run(() => changeRequestSigners(initialFormState, form({ id, requester, approver })));

  // ผู้จัดทำสร้าง + เลือกผู้อนุมัติ + ส่งขออนุมัติ → คืน id ใบเบิกสถานะ PENDING
  async function pendingRequest(centerId: string, extra: Record<string, string> = {}) {
    await loginAs("CREATOR");
    const id = idFrom(await save({ ...valid(centerId, extra), confirmWarnings: "1" }));
    await pickSigners(id, "", await userId("APPROVER"));
    await status(id, "SUBMIT");
    return id;
  }

  // ... + ผู้อนุมัติกดอนุมัติ → คืน id ใบเบิกสถานะ APPROVED (อยู่ในคิวฝ่ายบัญชี)
  async function approvedRequest(centerId: string, extra: Record<string, string> = {}) {
    const id = await pendingRequest(centerId, extra);
    await loginAs("APPROVER");
    await status(id, "APPROVE");
    return id;
  }

  return { createUsers, loginAs, userId, center, valid, save, idFrom, status, pickSigners, pendingRequest, approvedRequest };
}
