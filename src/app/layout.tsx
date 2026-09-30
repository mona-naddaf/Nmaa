import type { Metadata, Viewport } from "next";
import { Markazi_Text, Tajawal } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer/SiteFooter";

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
  title: "على مُكث",
  applicationName: "على مُكث",
  description: "منصّة متابعة تسميع وحفظ الطلاب",
};

export const viewport: Viewport = {
  themeColor: "#3f6650",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${markaziText.variable} ${tajawal.variable}`}>
      <body>
        <div className="site-main">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
