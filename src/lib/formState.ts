import type { FieldErrors } from "@/lib/validation";

// ผลลัพธ์ของ Server Action ที่ใช้กับ useActionState
export type FormState = {
  error?: string; // ข้อความรวมด้านบนฟอร์ม
  fieldErrors?: FieldErrors; // ข้อความใต้ช่อง
  values?: Record<string, string>; // ค่าที่กรอกไว้ เติมกลับเมื่อ error
  tempPassword?: string; // รหัสชั่วคราวที่ต้องแสดงให้ admin ครั้งเดียว
  message?: string; // ข้อความแจ้งผลสำเร็จ
};

export const initialFormState: FormState = {};
