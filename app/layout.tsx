import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "政策文件对比（极简一行版UI）",
  description: "今年文件 + 去年文件 + 结果，一行展示",
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

