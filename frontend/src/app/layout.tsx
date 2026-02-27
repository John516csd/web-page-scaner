import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Globe } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Web Page Scanner",
  description: "Web Page 工具集合 — 网页检测、对比、分析",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <Globe className="h-5 w-5 text-primary" />
              <span>Web Page Scanner</span>
            </Link>
          </div>
        </header>
        <Separator />
        <TooltipProvider>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </TooltipProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
