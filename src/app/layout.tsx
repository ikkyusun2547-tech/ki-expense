import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ระบบเบิกค่าอินเทอร์เน็ต",
  description: "ระบบเบิกค่าอินเทอร์เน็ต 3BB ของศูนย์ — บริษัท น้ำตาลสุรินทร์ จำกัด",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${sarabun.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
