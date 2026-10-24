import { Alert } from "@/components/ui";

// รหัสชั่วคราวแสดงครั้งเดียว — DB เก็บแค่ hash เปิดดูย้อนหลังไม่ได้
export function TempPasswordNotice({ message, password }: { message?: string; password: string }) {
  return (
    <Alert tone="success">
      {message && <p className="mb-2 font-medium">{message}</p>}
      <p>
        รหัสผ่านชั่วคราว:{" "}
        <code className="rounded bg-white px-2 py-0.5 tabular-nums text-base tracking-wider text-slate-900">{password}</code>
      </p>
      <p className="mt-2 text-xs">
        จดหรือคัดลอกส่งให้ผู้ใช้ตอนนี้ — รหัสนี้จะแสดงครั้งเดียว ผู้ใช้ต้องตั้งรหัสใหม่เองตอนล็อกอินครั้งแรก
      </p>
    </Alert>
  );
}
