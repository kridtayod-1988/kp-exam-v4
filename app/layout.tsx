import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ก.พ. E-EXAM 2569",
  description: "ระบบฝึกสอบและคลังข้อสอบ ก.พ. พร้อม Supabase Auth",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
