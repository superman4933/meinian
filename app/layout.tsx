import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "美年大健康 - 政策对比工具",
  description: "美年大健康政策文件对比工具，支持新年度和旧年度政策文件的智能对比分析",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}

