import { z } from "zod";
import { parseAmount } from "@/lib/money";

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

const role = z.enum(["CREATOR", "ACCOUNTING", "ADMIN"], { error: "เลือกบทบาท" });

const email = z
  .string()
  .trim()
  .toLowerCase()
  .transform((s) => (s === "" ? null : s))
  .pipe(z.email({ error: "อีเมลไม่ถูกต้อง" }).nullable());

export const userCreateSchema = z.object({
  username,
  name: requiredText("ชื่อ-นามสกุล", 100),
  email,
  role,
});

export const userUpdateSchema = z.object({
  name: requiredText("ชื่อ-นามสกุล", 100),
  email,
  role,
  active: z.enum(["true", "false"]).transform((v) => v === "true"),
});

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

// ---------- ตัวช่วย ----------

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}

// FormData → object ของข้อความ (ไม่รวมไฟล์) ใช้ทั้ง parse และส่งค่ากลับไปเติมฟอร์มเมื่อ error
export function formValues(formData: FormData, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}
