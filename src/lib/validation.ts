import { z } from "zod";
import { parseAmount } from "@/lib/money";
import { DEFAULT_MEMO_TEXTS } from "@/lib/pdf/memoData";
import { isSignerRole } from "@/lib/status";

// ตรวจข้อมูลจากฟอร์ม — ใช้ในฝั่งเซิร์ฟเวอร์ (Server Actions) เสมอ ห้ามเชื่อค่าจากเบราว์เซอร์

export const MIN_PASSWORD_LENGTH = 8;

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: `กรอก${label}` })
    .max(max, { error: `${label}ยาวเกิน ${max} ตัวอักษร` });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `ยาวเกิน ${max} ตัวอักษร` })
    .transform((s) => (s === "" ? null : s));

// ---------- ศูนย์ ----------

export const centerSchema = z.object({
  customerCode: requiredText("รหัสลูกค้า", 50),
  serviceNumber: optionalText(50),
  name: requiredText("ชื่อศูนย์", 200),
  normalAmount: z
    .string()
    .trim()
    .transform((s, ctx) => {
      const amount = parseAmount(s);
      if (amount === null) {
        ctx.addIssue({ code: "custom", message: "ยอดต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง" });
        return z.NEVER;
      }
      return amount;
    }),
  dueDay: z.coerce
    .number({ error: "วันครบกำหนดต้องเป็นตัวเลข" })
    .int({ error: "วันครบกำหนดต้องเป็นจำนวนเต็ม" })
    .min(1, { error: "วันครบกำหนดต้องอยู่ระหว่าง 1-31" })
    .max(31, { error: "วันครบกำหนดต้องอยู่ระหว่าง 1-31" }),
  status: z.enum(["ACTIVE", "MOVED", "CLOSED"], { error: "เลือกสถานะ" }),
});

export type CenterInput = z.infer<typeof centerSchema>;

// ---------- ผู้ใช้ ----------

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, { error: "ชื่อผู้ใช้ 3-32 ตัว ใช้ได้เฉพาะ a-z 0-9 . _ -" });

const role = z.enum(["CREATOR", "ACCOUNTING", "APPROVER", "ADMIN"], { error: "เลือกบทบาท" });

// ผู้จัดทำ/ผู้อนุมัติต้องมีตำแหน่ง เพราะพิมพ์ใต้ชื่อในใบเบิก
function requireTitleForSigner(v: { role: z.infer<typeof role>; title: string | null }, ctx: z.RefinementCtx) {
  if (isSignerRole(v.role) && !v.title) {
    ctx.addIssue({ code: "custom", path: ["title"], message: "กรอกตำแหน่ง (พิมพ์ใต้ชื่อในใบเบิก)" });
  }
}

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, { error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร` })
  .max(128, { error: "รหัสผ่านยาวเกินไป" });

// admin ตั้งรหัสผ่านให้ (สร้างบัญชี/รีเซ็ต) — ผู้ใช้ต้องเปลี่ยนเองตอนล็อกอินครั้งถัดไป
export const setPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], error: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" });

const email = z
  .string()
  .trim()
  .toLowerCase()
  .transform((s) => (s === "" ? null : s))
  .pipe(z.email({ error: "อีเมลไม่ถูกต้อง" }).nullable());

export const userCreateSchema = z
  .object({
    username,
    name: requiredText("ชื่อ-นามสกุล", 100),
    title: optionalText(100),
    email,
    role,
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], error: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" })
  .superRefine(requireTitleForSigner);

export const userUpdateSchema = z
  .object({
    username,
    name: requiredText("ชื่อ-นามสกุล", 100),
    title: optionalText(100),
    email,
    role,
    active: z.enum(["true", "false"]).transform((v) => v === "true"),
  })
  .superRefine(requireTitleForSigner);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "กรอกรหัสผ่านปัจจุบัน" }),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, { error: `รหัสผ่านใหม่ต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร` })
      .max(128, { error: "รหัสผ่านยาวเกินไป" }),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    error: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม",
  });

// ---------- ข้อความหัวบันทึกของใบเบิก (จาก / เรียน / เพื่อ) ----------

// เว้นว่าง = ใช้ข้อความตามฟอร์มจริง (ช่องพับไว้ในฟอร์ม ผู้ใช้อาจลบทิ้งโดยไม่ตั้งใจ)
const memoText = (label: string, fallback: string) =>
  z
    .string()
    .trim()
    .max(150, { error: `${label}ยาวเกิน 150 ตัวอักษร` })
    .transform((s) => s || fallback);

export const memoTextsSchema = z.object({
  department: memoText("จาก (ชื่อฝ่าย)", DEFAULT_MEMO_TEXTS.department),
  recipient: memoText("เรียน", DEFAULT_MEMO_TEXTS.recipient),
  purpose: memoText("เพื่อ", DEFAULT_MEMO_TEXTS.purpose),
});

// ---------- ตัวช่วย ----------

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}

// FormData → object ของข้อความ (ไม่รวมไฟล์) ใช้ทั้ง parse และส่งค่ากลับไปเติมฟอร์มเมื่อ error
export function formValues(formData: FormData, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}
