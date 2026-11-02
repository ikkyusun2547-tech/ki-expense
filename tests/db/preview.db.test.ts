import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildMemo } from "@/lib/pdf/memoData";
import type { CurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { previewMemoInput, type PreviewArgs } from "@/server/services/requests";
import { requestFixtures, type FixtureUser } from "./requestFixtures";

// ตัวอย่าง PDF จากข้อมูลในฟอร์ม (ยังไม่บันทึก) — ไม่เขียนอะไรลง DB
const { createUsers, userId, center } = requestFixtures("zz-prev-");

async function asUser(user: FixtureUser): Promise<CurrentUser> {
  const u = await db.user.findUniqueOrThrow({ where: { id: await userId(user) } });
  return { id: u.id, username: u.username, name: u.name, role: u.role, mustChangePassword: false };
}

const args = async (centerId: string, extra: Partial<PreviewArgs> = {}): Promise<PreviewArgs> => ({
  actor: await asUser("CREATOR"),
  centerId,
  amount: "749",
  packageAmount: "",
  extraAmount: "",
  periodEnd: "2026-09-30",
  dueDate: "2026-10-15",
  approverId: null,
  requesterId: null,
  texts: { department: "", recipient: "", purpose: "" },
  ...extra,
});

beforeAll(createUsers);
afterAll(() => db.$disconnect());

describe("ตัวอย่างใบเบิก PDF ก่อนบันทึก", () => {
  it("ใช้ค่าที่กรอก + ผู้อนุมัติที่เลือก + ข้อความตามฟอร์มจริงเมื่อเว้นว่าง; ไม่สร้างใบเบิก", async () => {
    const c = await center();
    const before = await db.request.count();
    const result = await previewMemoInput(await args(c.id, { approverId: await userId("APPROVER") }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const memo = buildMemo(result.input);
    expect(memo.total).toBe("749.00");
    expect(memo.approver).toEqual({ name: "ทดสอบ approver", title: "ผู้จัดการส่วน" });
    expect(memo.requester).toEqual({ name: "ทดสอบ creator", title: "เจ้าหน้าที่ธุรการ" });
    expect(memo.to).toBe("ผู้จัดการฝ่ายบัญชี - ผู้จัดการฝ่ายการเงิน");
    expect(await db.request.count()).toBe(before);
  });

  it("ยอดไม่ถูกต้อง / ไม่มีวันครบกำหนด / ผู้อนุมัติไม่ใช่บทบาทผู้อนุมัติ → แจ้งเป็นภาษาไทย", async () => {
    const c = await center();
    expect(await previewMemoInput(await args(c.id, { amount: "abc" }))).toMatchObject({ ok: false, error: expect.stringContaining("ยอดเงิน") });
    expect(await previewMemoInput(await args(c.id, { dueDate: "" }))).toMatchObject({ ok: false, error: expect.stringContaining("วันครบกำหนด") });
    expect(await previewMemoInput(await args(c.id, { approverId: await userId("CREATOR2") }))).toMatchObject({
      ok: false,
      error: expect.stringContaining("ผู้ลงนาม"),
    });
  });
});
