import type { CenterStatus, Role } from "@/generated/prisma/enums";
import { initialFormState } from "@/lib/formState";
import { login } from "@/server/actions/auth";
import { changeRequestStatus, saveRequest } from "@/server/actions/requests";
import { db } from "@/server/db";
import { hashPassword } from "@/server/password";
import { form, PASSWORD, run } from "./helpers";
import { cookieJar } from "./setup";

// ตัวช่วยสำหรับ test ที่สร้างใบเบิก (มี ApprovalLog ซึ่งลบไม่ได้)
// แต่ละไฟล์ใช้ prefix ของตัวเอง; DB ทดสอบถูกล้างใหม่ทุกครั้งที่รัน จึงไม่ต้อง cleanup

export const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
export const pdfFile = (name = "ใบแจ้งหนี้.pdf") => new File([PDF], name, { type: "application/pdf" });

export function requestFixtures(prefix: string) {
  const P = `${prefix}${Date.now()}-`;
  let seq = 0;

  async function createUsers() {
    for (const role of ["CREATOR", "ACCOUNTING", "ADMIN"] as const) {
      await db.user.create({
        data: { username: `${P}${role.toLowerCase()}`, name: `ทดสอบ ${role}`, role, passwordHash: await hashPassword(PASSWORD), mustChangePassword: false },
      });
    }
  }

  async function loginAs(role: Role) {
    cookieJar.clear();
    await run(() => login(initialFormState, form({ username: `${P}${role.toLowerCase()}`, password: PASSWORD })));
  }

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

  // ผู้จัดทำสร้าง + ส่งบัญชี → คืน id ใบเบิกสถานะ SENT
  async function sentRequest(centerId: string, extra: Record<string, string> = {}) {
    await loginAs("CREATOR");
    const id = idFrom(await save({ ...valid(centerId, extra), confirmWarnings: "1" }));
    await status(id, "SEND");
    return id;
  }

  return { createUsers, loginAs, center, valid, save, idFrom, status, sentRequest };
}
