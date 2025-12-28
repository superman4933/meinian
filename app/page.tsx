"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { FileUpload } from "@/components/file-upload";
import { Toolbar } from "@/components/toolbar";
import { ComparisonTable } from "@/components/comparison-table";
import { Login } from "@/components/login";
import { FileProvider } from "@/contexts/file-context";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [isAutoLogging, setIsAutoLogging] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [filterStatus, setFilterStatus] = useState("全部状态");

  // 检查是否有保存的登录信息并自动登录
  useEffect(() => {
    const checkAutoLogin = async () => {
      if (typeof window === "undefined") return;

      const savedUsername = localStorage.getItem("savedUsername");
      const savedPassword = localStorage.getItem("savedPassword");

      if (savedUsername && savedPassword) {
        setIsAutoLogging(true);
        try {
          const response = await fetch("/api/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ username: savedUsername, password: savedPassword }),
          });

          const data = await response.json();

          if (response.ok && data.success) {
            setUsername(savedUsername);
            setIsLoggedIn(true);
          } else {
            // 自动登录失败，清除保存的密码
            localStorage.removeItem("savedPassword");
          }
        } catch (err) {
          // 自动登录失败，清除保存的密码
          localStorage.removeItem("savedPassword");
        } finally {
          setIsAutoLogging(false);
          setIsChecking(false);
        }
      } else {
        setIsChecking(false);
      }
    };

    checkAutoLogin();
  }, []);

  const handleLoginSuccess = (loggedInUsername: string) => {
    setUsername(loggedInUsername);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    // 清除密码，保留用户名
    localStorage.removeItem("savedPassword");
    setUsername("");
    setIsLoggedIn(false);
  };

  // 显示加载状态
  if (isChecking || isAutoLogging) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4 animate-pulse">
            <svg className="h-8 w-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-lg font-semibold text-slate-700">正在自动登录...</p>
          <p className="text-sm text-slate-500 mt-2">请稍候</p>
        </div>
      </div>
    );
  }

  // 显示登录页面
  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // 显示主页面
  return (
    <FileProvider>
      <Header username={username} onLogout={handleLogout} />
      <main className="mx-auto max-w-[1400px] px-4 py-6 space-y-4">
        {/* File Upload Areas */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FileUpload type="lastYear" />
          <FileUpload type="thisYear" />
        </div>

        <Toolbar onFilterChange={setFilterStatus} />

        <ComparisonTable filterStatus={filterStatus} />
      </main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-10 text-xs text-slate-500">
        极简一行版：新年度文件｜旧年度文件｜对比结果（同一行）｜操作（单独比对/查看）
      </footer>
    </FileProvider>
  );
}

