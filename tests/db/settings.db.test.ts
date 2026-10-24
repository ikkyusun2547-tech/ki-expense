import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getRequestPdf } from "@/app/api/requests/[id]/pdf/route";
import { DEFAULT_MEMO_SETTINGS } from "@/lib/pdf/memoData";
import { updateReportSettings } from "@/server/actions/settings";
import { db } from "@/server/db";
import { getReportSettings } from "@/server/services/reportSettings";
import { form, run } from "./helpers";
import { requestFixtures } from "./requestFixtures";

const { createUsers, loginAs, center, valid, save, idFrom } = requestFixtures("zz-set-");

const values = {
  department: "ฝ่ายรัฐกิจสัมพันธ์และหลักทรัพย์",
  recipient: "ผู้จัดการฝ่ายบัญชี - ผู้จัดการฝ่ายการเงิน",
  purpose: "โปรดพิจารณา",
  requesterTitle: "เจ้าหน้าที่รัฐกิจสัมพันธ์",
  approverName: "นายทดสอบ อนุมัติ",
  approverTitle: "รักษาการผู้จัดการส่วนรัฐกิจและหลักทรัพย์",
  formCode: "FM-50000-02 Rev.02 วันบังคับใช้ 05/07/2566",
};

beforeAll(async () => {
  await db.reportSetting.deleteMany();
  await createUsers();
});
afterAll(() => db.$disconnect());

describe("ตั้งค่าใบเบิก", () => {
  it("ยังไม่เคยตั้งค่า → ใช้ค่าเริ่มต้น", async () => {
    expect(await getReportSettings()).toEqual(DEFAULT_MEMO_SETTINGS);
  });

  it.each(["CREATOR", "ACCOUNTING"] as const)("%s แก้ไม่ได้", async (role) => {
    await loginAs(role);
    expect(await run(() => updateReportSettings({}, form(values)))).toEqual({ redirect: "/" });
    expect(await getReportSettings()).toEqual(DEFAULT_MEMO_SETTINGS);
  });

  it("admin บันทึกได้ ชื่อผู้อนุมัติเว้นว่างได้ แต่ช่องอื่นต้องกรอก", async () => {
    await loginAs("ADMIN");
    const missing = await run(() => updateReportSettings({}, form({ ...values, department: " " })));
    expect(missing).toMatchObject({ result: { fieldErrors: { department: ["กรอกชื่อฝ่าย (จาก)"] } } });

    expect(await run(() => updateReportSettings({}, form({ ...values, approverName: "" })))).toMatchObject({
      result: { message: expect.stringContaining("บันทึกแล้ว") },
    });
    expect((await getReportSettings()).approverName).toBe("");

    await run(() => updateReportSettings({}, form(values)));
    expect(await getReportSettings()).toEqual(values);
  });

  it("PDF ที่พิมพ์ใช้ค่าตั้งปัจจุบันได้ (สร้างไฟล์สำเร็จ)", async () => {
    const c = await center();
    await loginAs("CREATOR");
    const id = idFrom(await save(valid(c.id)));
    const res = await getRequestPdf(new Request("http://x"), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });
});
