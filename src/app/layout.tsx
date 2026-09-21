import type { Metadata } from "next";
import { Markazi_Text, Tajawal } from "next/font/google";
import "./globals.css";

const markaziText = Markazi_Text({
  variable: "--font-markazi",
  subsets: ["arabic", "latin"],
  weight: ["500", "700"],
});

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
  title: "نماء",
  description: "منصّة متابعة تسميع وحفظ الطلاب",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${markaziText.variable} ${tajawal.variable}`}>
      <body>{children}</body>
    </html>
  );
}
