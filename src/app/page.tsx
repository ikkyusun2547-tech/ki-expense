import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HOME_PATH } from "@/lib/auth/routes";
import { getCurrentUser } from "@/server/auth";

// หน้าแรก: พาไปหน้าของบทบาทตัวเอง หรือหน้าล็อกอิน
export default function Home() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">กำลังโหลด…</p>}>
      <RedirectByRole />
    </Suspense>
  );
}

async function RedirectByRole(): Promise<null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  redirect(HOME_PATH[user.role]);
}
