import { vi } from "vitest";

// จำลอง runtime ของ Next ให้ Server Actions รันใน Vitest ได้กับ DB ทดสอบ (internet_expense_test)
// - cookies(): เก็บในหน่วยความจำ (cookieJar) แทน cookie ของเบราว์เซอร์
// - redirect(): ใช้ของจริงจาก next/navigation (throw NEXT_REDIRECT) แล้วอ่านปลายทางด้วย redirectTarget()

export const cookieJar = new Map<string, string>();

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
    has: (name: string) => cookieJar.has(name),
  }),
  headers: async () => new Headers(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

// React cache() ภายนอก request ของ Next จะไม่จำค่า — ตรงกับที่ต้องการ (อ่าน DB ทุกครั้ง)
