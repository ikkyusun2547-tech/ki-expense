// แสดงระหว่างโหลดหน้าใหม่ — ทำให้ทุกหน้าในกลุ่มนี้อยู่ใน Suspense ของตัวเอง (หน้าอ่าน DB ทุกครั้ง)
export default function Loading() {
  return <p className="text-sm text-zinc-500">กำลังโหลด…</p>;
}
