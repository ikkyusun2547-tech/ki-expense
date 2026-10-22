import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_PATHS, SESSION_COOKIE } from "@/lib/auth/routes";

// ด่านแรกแบบเร็ว: ไม่มี cookie session เลย → ไปหน้าล็อกอิน
// ไม่ใช่การตรวจสิทธิ์จริง (ไม่แตะ DB) — การตรวจจริงอยู่ใน requireUser/requireRole ฝั่งเซิร์ฟเวอร์
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
