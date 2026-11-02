import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { getNavCounts } from "@/server/services/navCounts";
import { requestFixtures, type FixtureUser } from "./requestFixtures";

// ตัวเลขงานค้างบนเมนู — DB ทดสอบมีข้อมูลจากไฟล์อื่นด้วย จึงเทียบเป็นส่วนต่าง (ยกเว้นคิวของผู้อนุมัติคนนี้ที่นับเฉพาะตัว)
const { createUsers, loginAs, userId, center, valid, save, idFrom, status, pendingRequest } = requestFixtures("zz-nav-");

async function asUser(user: FixtureUser): Promise<CurrentUser> {
  const u = await db.user.findUniqueOrThrow({ where: { id: await userId(user) } });
  return { id: u.id, username: u.username, name: u.name, role: u.role, mustChangePassword: false };
}
const countOf = async (user: FixtureUser, href: string) => (await getNavCounts(await asUser(user)))[href]?.count ?? 0;

beforeAll(createUsers);
afterAll(() => db.$disconnect());

describe("ตัวเลขงานค้างบนเมนู", () => {
  it("แต่ละบทบาทเห็นเฉพาะเมนูของตัวเอง", async () => {
    expect(Object.keys(await getNavCounts(await asUser("APPROVER"))).every((k) => k === "/approvals")).toBe(true);
    expect(Object.keys(await getNavCounts(await asUser("ACCOUNTING"))).every((k) => k === "/accounting")).toBe(true);
    expect(Object.keys(await getNavCounts(await asUser("CREATOR"))).every((k) => k === "/requests")).toBe(true);
  });

  it("ส่งขออนุมัติ → ผู้อนุมัติคนนั้น +1 (คนอื่นไม่เพิ่ม); อนุมัติ → ฝ่ายบัญชี +1; ใบร่างของผู้จัดทำนับด้วย", async () => {
    const before = {
      approver: await countOf("APPROVER", "/approvals"),
      approver2: await countOf("APPROVER2", "/approvals"),
      accounting: await countOf("ACCOUNTING", "/accounting"),
      drafts: await countOf("CREATOR", "/requests"),
      otherDrafts: await countOf("CREATOR2", "/requests"),
    };

    const c = await center();
    await loginAs("CREATOR");
    idFrom(await save(valid(c.id))); // ใบร่าง
    expect(await countOf("CREATOR", "/requests")).toBe(before.drafts + 1);
    expect(await countOf("CREATOR2", "/requests")).toBe(before.otherDrafts); // นับเฉพาะใบของตัวเอง

    const c2 = await center();
    const id = await pendingRequest(c2.id);
    expect(await countOf("APPROVER", "/approvals")).toBe(before.approver + 1);
    expect(await countOf("APPROVER2", "/approvals")).toBe(before.approver2);
    expect((await getNavCounts(await asUser("APPROVER")))["/approvals"]?.tone).toBe("amber");

    await loginAs("APPROVER");
    await status(id, "APPROVE");
    expect(await countOf("APPROVER", "/approvals")).toBe(before.approver);
    expect(await countOf("ACCOUNTING", "/accounting")).toBe(before.accounting + 1);
  });

  it("admin เห็นภาพรวมเป็นสีเทา", async () => {
    const counts = await getNavCounts(await asUser("ADMIN"));
    for (const c of Object.values(counts)) expect(c.tone).toBe("zinc");
  });
});
