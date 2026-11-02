import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { initialFormState } from "@/lib/formState";
import { changePassword, login, logout } from "@/server/actions/auth";
import { createCenterForTest } from "./centers.fixtures";
import { saveCenter, deleteCenter } from "@/server/actions/centers";
import { createUser, resetPassword, updateUser } from "@/server/actions/users";
import { db } from "@/server/db";
import { verifyPassword } from "@/server/password";
import { cleanup, createTestUser, form, PASSWORD, PREFIX, run } from "./helpers";
import { cookieJar } from "./setup";

const loginAs = async (name: string, password = PASSWORD) =>
  run(() => login(initialFormState, form({ username: `${PREFIX}${name}`, password })));

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("จดจำฉัน", () => {
  const hoursLeft = async (userId: string) => {
    const s = await db.session.findFirstOrThrow({ where: { userId }, orderBy: { createdAt: "desc" } });
    return (s.expiresAt.getTime() - Date.now()) / 3_600_000;
  };

  it("ไม่ติ๊ก = 12 ชั่วโมง; ติ๊ก = 30 วัน (cookie หมดอายุตรงกัน)", async () => {
    const u = await createTestUser("remember", "ACCOUNTING");
    await run(() => login(initialFormState, form({ username: `${PREFIX}remember`, password: PASSWORD })));
    expect(await hoursLeft(u.id)).toBeCloseTo(12, 0);

    cookieJar.clear();
    await run(() => login(initialFormState, form({ username: `${PREFIX}remember`, password: PASSWORD, remember: "on" })));
    expect(await hoursLeft(u.id)).toBeCloseTo(30 * 24, 0);
  });
});

describe("ล็อกอิน", () => {
  it("รหัสถูก → ได้ cookie session และไปหน้าของบทบาท", async () => {
    await createTestUser("creator", "CREATOR");
    expect(await loginAs("creator")).toEqual({ redirect: "/home" });
    expect(cookieJar.size).toBe(1);
  });

  it("ต้องเปลี่ยนรหัส → ไปหน้าเปลี่ยนรหัสก่อน", async () => {
    await createTestUser("new", "ACCOUNTING", { mustChangePassword: true });
    expect(await loginAs("new")).toEqual({ redirect: "/change-password" });
  });

  it("รหัสผิด / ไม่มีชื่อผู้ใช้ → ข้อความเดียวกัน (ไม่บอกว่าผิดที่อะไร)", async () => {
    await createTestUser("creator", "CREATOR");
    const wrongPassword = await loginAs("creator", "wrong");
    const noSuchUser = await loginAs("nobody");
    expect(wrongPassword).toEqual({ result: { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", values: { username: `${PREFIX}creator` } } });
    expect(noSuchUser).toEqual({ result: { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", values: { username: `${PREFIX}nobody` } } });
    expect(cookieJar.size).toBe(0);
  });

  it("บัญชีที่ปิดใช้งาน ล็อกอินไม่ได้แม้รหัสถูก", async () => {
    const user = await createTestUser("off", "CREATOR");
    await db.user.update({ where: { id: user.id }, data: { active: false } });
    expect(await loginAs("off")).toMatchObject({ result: { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" } });
  });

  it("ผิด 5 ครั้ง → ล็อก แม้ครั้งที่ 6 ใส่รหัสถูก", async () => {
    await createTestUser("creator", "CREATOR");
    for (let i = 0; i < 5; i++) await loginAs("creator", "wrong");
    const result = await loginAs("creator");
    expect(result).toMatchObject({ result: { error: expect.stringContaining("ใส่รหัสผ่านผิดหลายครั้ง") } });
    expect(cookieJar.size).toBe(0);
  });

  it("ออกจากระบบ → session ใน DB ถูกลบ", async () => {
    const user = await createTestUser("creator", "CREATOR");
    await loginAs("creator");
    expect(await run(() => logout())).toEqual({ redirect: "/login" });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("เปลี่ยนรหัสผ่าน", () => {
  it("สำเร็จ → mustChangePassword ปิด และใช้รหัสใหม่ได้", async () => {
    const user = await createTestUser("new", "CREATOR", { mustChangePassword: true });
    await loginAs("new");
    const result = await run(() =>
      changePassword(initialFormState, form({ currentPassword: PASSWORD, newPassword: "brand-new-pass", confirmPassword: "brand-new-pass" })),
    );
    expect(result).toEqual({ redirect: "/home" });
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.mustChangePassword).toBe(false);
    expect(await verifyPassword("brand-new-pass", updated.passwordHash)).toBe(true);
  });

  it("รหัสปัจจุบันผิด → ไม่เปลี่ยน", async () => {
    await createTestUser("creator", "CREATOR");
    await loginAs("creator");
    const result = await run(() =>
      changePassword(initialFormState, form({ currentPassword: "wrong", newPassword: "brand-new-pass", confirmPassword: "brand-new-pass" })),
    );
    expect(result).toEqual({ result: { fieldErrors: { currentPassword: ["รหัสผ่านปัจจุบันไม่ถูกต้อง"] } } });
  });
});

describe("เช็กสิทธิ์ฝั่งเซิร์ฟเวอร์ (เรียก action ตรง ๆ ไม่ผ่านหน้าจอ)", () => {
  const centerForm = () =>
    form({ customerCode: `${PREFIX}C1`, serviceNumber: "", provider: "3BB", name: "ศูนย์ทดสอบ", normalAmount: "749", dueDay: "5", status: "ACTIVE" });

  it("ไม่ได้ล็อกอิน → ถูกส่งไปหน้าล็อกอิน และไม่มีอะไรถูกบันทึก", async () => {
    expect(await run(() => saveCenter(initialFormState, centerForm()))).toEqual({ redirect: "/login" });
    expect(await run(() => createUser(initialFormState, form({ username: `${PREFIX}x`, name: "x", email: "", role: "ADMIN" })))).toEqual({
      redirect: "/login",
    });
    expect(await db.center.count({ where: { customerCode: `${PREFIX}C1` } })).toBe(0);
    expect(await db.user.count({ where: { username: `${PREFIX}x` } })).toBe(0);
  });

  it.each(["CREATOR", "ACCOUNTING"] as const)("%s เพิ่มศูนย์/สร้างผู้ใช้ไม่ได้", async (role) => {
    await createTestUser("u", role);
    await loginAs("u");
    expect(await run(() => saveCenter(initialFormState, centerForm()))).toEqual({ redirect: "/" });
    expect(await run(() => createUser(initialFormState, form({ username: `${PREFIX}x`, name: "x", email: "", role: "ADMIN" })))).toEqual({
      redirect: "/",
    });
    expect(await db.center.count({ where: { customerCode: `${PREFIX}C1` } })).toBe(0);
    expect(await db.user.count({ where: { username: `${PREFIX}x` } })).toBe(0);
  });

  it("ผู้ที่ยังไม่เปลี่ยนรหัสครั้งแรก ทำ action อื่นไม่ได้", async () => {
    await createTestUser("admin", "ADMIN", { mustChangePassword: true });
    await loginAs("admin");
    expect(await run(() => saveCenter(initialFormState, centerForm()))).toEqual({ redirect: "/change-password" });
  });

  it("session ใช้ไม่ได้ทันทีเมื่อบัญชีถูกปิด", async () => {
    const user = await createTestUser("admin", "ADMIN");
    await loginAs("admin");
    await db.user.update({ where: { id: user.id }, data: { active: false } });
    expect(await run(() => saveCenter(initialFormState, centerForm()))).toEqual({ redirect: "/login" });
  });
});

describe("admin จัดการศูนย์", () => {
  beforeEach(async () => {
    await createTestUser("admin", "ADMIN");
    await loginAs("admin");
  });

  it("เพิ่มศูนย์ แล้วรหัสลูกค้าซ้ำถูกปฏิเสธ", async () => {
    const values = { customerCode: `${PREFIX}C1`, serviceNumber: "044", provider: "AIS", name: "ศูนย์ทดสอบ", normalAmount: "1,068.93", dueDay: "5", status: "ACTIVE" };
    expect(await run(() => saveCenter(initialFormState, form(values)))).toEqual({ redirect: "/admin/centers" });
    const saved = await db.center.findUniqueOrThrow({ where: { customerCode: `${PREFIX}C1` } });
    expect(saved.normalAmount.toFixed(2)).toBe("1068.93");
    expect(saved.provider).toBe("AIS");

    const dup = await run(() => saveCenter(initialFormState, form({ ...values, name: "ซ้ำ" })));
    expect(dup).toMatchObject({ result: { fieldErrors: { customerCode: ["รหัสลูกค้านี้มีในทะเบียนแล้ว"] } } });
  });

  it("ลบศูนย์ที่ไม่เคยมีใบเบิกได้ / ศูนย์ที่เคยมีใบเบิกลบไม่ได้", async () => {
    const empty = await createCenterForTest("C-empty");
    expect(await run(() => deleteCenter(initialFormState, form({ id: empty.id })))).toEqual({ redirect: "/admin/centers" });
    expect(await db.center.count({ where: { id: empty.id } })).toBe(0);

    const used = await createCenterForTest("C-used", { withRequest: true });
    const result = await run(() => deleteCenter(initialFormState, form({ id: used.id })));
    expect(result).toMatchObject({ result: { error: expect.stringContaining("เคยมีใบเบิก 1 ใบ ลบไม่ได้") } });
    expect(await db.center.count({ where: { id: used.id } })).toBe(1);
  });
});

describe("admin จัดการผู้ใช้", () => {
  it("สร้างผู้ใช้ด้วยรหัสที่ admin ตั้ง → ล็อกอินได้ และต้องเปลี่ยนรหัส", async () => {
    await createTestUser("admin", "ADMIN");
    await loginAs("admin");
    const values = { username: `${PREFIX}Somchai`, name: "สมชาย", title: "", email: "", role: "ACCOUNTING", password: "start-pass-1", confirmPassword: "start-pass-1" };
    expect(await run(() => createUser(initialFormState, form(values)))).toEqual({
      redirect: `/admin/users?created=${encodeURIComponent(`${PREFIX}somchai`)}`,
    });

    cookieJar.clear();
    expect(await loginAs("somchai", "start-pass-1")).toEqual({ redirect: "/change-password" });
  });

  it("สร้างผู้ใช้: รหัสสั้น/ไม่ตรงกันไม่ได้, ผู้จัดทำและผู้อนุมัติต้องมีตำแหน่ง, ไม่ส่งรหัสกลับไปในฟอร์ม", async () => {
    await createTestUser("admin", "ADMIN");
    await loginAs("admin");
    const base = { username: `${PREFIX}approver1`, name: "นายผู้อนุมัติ", title: "", email: "", role: "APPROVER", password: "start-pass-1", confirmPassword: "start-pass-1" };

    const short = await run(() => createUser(initialFormState, form({ ...base, title: "ผู้จัดการ", password: "short", confirmPassword: "short" })));
    expect(short).toMatchObject({ result: { fieldErrors: { password: ["รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"] } } });
    expect((short as { result: { values: Record<string, string> } }).result.values).not.toHaveProperty("password");

    expect(await run(() => createUser(initialFormState, form({ ...base, title: "ผู้จัดการ", confirmPassword: "other-pass" })))).toMatchObject({
      result: { fieldErrors: { confirmPassword: ["รหัสผ่านทั้งสองช่องไม่ตรงกัน"] } },
    });
    expect(await run(() => createUser(initialFormState, form(base)))).toMatchObject({
      result: { fieldErrors: { title: ["กรอกตำแหน่ง (พิมพ์ใต้ชื่อในใบเบิก)"] } },
    });

    expect(await run(() => createUser(initialFormState, form({ ...base, title: "ผู้จัดการส่วน" })))).toMatchObject({ redirect: expect.any(String) });
    expect(await db.user.findUniqueOrThrow({ where: { username: `${PREFIX}approver1` } })).toMatchObject({
      role: "APPROVER",
      title: "ผู้จัดการส่วน",
      mustChangePassword: true,
    });
  });

  it("admin เปลี่ยนชื่อผู้ใช้ได้ (ตัวพิมพ์เล็ก, ห้ามซ้ำ) → ล็อกอินด้วยชื่อใหม่", async () => {
    await createTestUser("admin", "ADMIN");
    const target = await createTestUser("oldname", "ACCOUNTING");
    await loginAs("admin");
    const values = { id: target.id, name: "x", title: "", email: "", role: "ACCOUNTING", active: "true" };

    expect(await run(() => updateUser(initialFormState, form({ ...values, username: `${PREFIX}admin` })))).toMatchObject({
      result: { fieldErrors: { username: ["ชื่อผู้ใช้นี้มีอยู่แล้ว"] } },
    });
    expect(await run(() => updateUser(initialFormState, form({ ...values, username: ` ${PREFIX}User3 ` })))).toEqual({ redirect: "/admin/users" });
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).username).toBe(`${PREFIX}user3`);

    cookieJar.clear();
    expect(await loginAs("oldname")).toMatchObject({ result: { error: expect.any(String) } });
    expect(await loginAs("user3")).toEqual({ redirect: "/accounting" });
  });

  it("admin เปลี่ยนบทบาท/ปิดบัญชีตัวเองไม่ได้", async () => {
    const admin = await createTestUser("admin", "ADMIN");
    await loginAs("admin");
    const result = await run(() => updateUser(initialFormState, form({ id: admin.id, username: `${PREFIX}admin`, name: "x", title: "ตำแหน่ง", email: "", role: "CREATOR", active: "true" })));
    expect(result).toMatchObject({ result: { error: "เปลี่ยนบทบาทหรือปิดบัญชีของตัวเองไม่ได้" } });
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe("ADMIN");
  });

  it("ปิดบัญชี / รีเซ็ตรหัส → ผู้ใช้นั้นถูกออกจากระบบทุกเครื่อง", async () => {
    const target = await createTestUser("target", "CREATOR");
    await loginAs("target");
    const targetCookie = new Map(cookieJar);
    expect(await db.session.count({ where: { userId: target.id } })).toBe(1);

    cookieJar.clear();
    await createTestUser("admin", "ADMIN");
    await loginAs("admin");
    expect(await run(() => resetPassword(initialFormState, form({ id: target.id, password: "new-pass-1", confirmPassword: "x" })))).toMatchObject({
      result: { fieldErrors: { confirmPassword: ["รหัสผ่านทั้งสองช่องไม่ตรงกัน"] } },
    });
    expect(await db.session.count({ where: { userId: target.id } })).toBe(1);

    const reset = await run(() => resetPassword(initialFormState, form({ id: target.id, password: "new-pass-1", confirmPassword: "new-pass-1" })));
    expect(reset).toMatchObject({ result: { message: expect.stringContaining("ตั้งรหัสผ่านใหม่แล้ว") } });
    expect(await verifyPassword("new-pass-1", (await db.user.findUniqueOrThrow({ where: { id: target.id } })).passwordHash)).toBe(true);
    expect(await db.session.count({ where: { userId: target.id } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).mustChangePassword).toBe(true);

    // cookie เดิมของผู้ใช้นั้นใช้ไม่ได้แล้ว
    cookieJar.clear();
    for (const [k, v] of targetCookie) cookieJar.set(k, v);
    expect(await run(() => saveCenter(initialFormState, form({})))).toEqual({ redirect: "/login" });
  });
});
