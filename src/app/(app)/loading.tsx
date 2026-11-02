// แสดงระหว่างโหลดหน้าใหม่ — ทำให้ทุกหน้าในกลุ่มนี้อยู่ใน Suspense ของตัวเอง (หน้าอ่าน DB ทุกครั้ง)
export default function Loading() {
  return (
    <div className="animate-pulse" aria-label="กำลังโหลด">
      <div className="mb-6 flex items-center gap-3">
        <div className="size-10 rounded-xl bg-slate-200" />
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-md bg-slate-200" />
          <div className="h-4 w-72 rounded-md bg-slate-100" />
        </div>
      </div>
      <div className="h-64 rounded-2xl border border-slate-200/70 bg-white" />
    </div>
  );
}
