"use client";

import { useState, useEffect, FormEvent } from "react";

interface LoginProps {
  onLoginSuccess: (username: string) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // 自动填充保存的用户名
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUsername = localStorage.getItem("savedUsername");
      if (savedUsername) {
        setUsername(savedUsername);
      }
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 保存账号密码到 localStorage
        localStorage.setItem("savedUsername", username);
        localStorage.setItem("savedPassword", password);
        onLoginSuccess(username);
      } else {
        setError(data.message || "登录失败，请检查用户名和密码");
      }
    } catch (err) {
      setError("登录失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/50 to-purple-50/30">
      {/* 静态渐变背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100/40 via-purple-100/30 to-pink-100/40"></div>
      
      {/* 流动光线效果 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-1/4 left-0 w-1/3 h-1 bg-gradient-to-r from-transparent via-blue-400/30 to-transparent animate-flow-right"></div>
          <div className="absolute top-1/2 right-0 w-1/3 h-1 bg-gradient-to-l from-transparent via-purple-400/30 to-transparent animate-flow-left"></div>
          <div className="absolute bottom-1/4 left-1/3 w-1/3 h-1 bg-gradient-to-r from-transparent via-pink-400/30 to-transparent animate-flow-right" style={{ animationDelay: '1.5s' }}></div>
        </div>
      </div>

      {/* 浮动几何图形 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 border-2 border-blue-300/20 rounded-lg rotate-45 animate-float"></div>
        <div className="absolute top-40 right-20 w-24 h-24 border-2 border-purple-300/20 rounded-full animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-32 left-1/4 w-20 h-20 border-2 border-pink-300/20 rounded-lg rotate-12 animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-20 right-1/3 w-28 h-28 border-2 border-blue-300/20 rounded-full animate-float" style={{ animationDelay: '0.5s' }}></div>
      </div>

      {/* 背景装饰 - 柔和光晕 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl animate-breathe"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-300/20 rounded-full blur-3xl animate-breathe" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-300/15 rounded-full blur-3xl animate-breathe" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* 网格背景 */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] opacity-40"></div>

      <div className="w-full max-w-md relative z-10 -mt-20">
        {/* Logo 和标题区域 */}
        <div className="text-center mb-10">
          {/* Logo 图片 - 圆角矩形 */}
          <div className="flex items-center justify-center mb-6">
            <div className="rounded-2xl bg-white/90 backdrop-blur-sm p-4 shadow-xl border border-white/50">
              <img
                src="/logo.png"
                alt="美年大健康"
                className="h-16 w-auto object-contain"
                onError={(e) => {
                  // 如果图片加载失败，尝试其他可能的文件名
                  const target = e.target as HTMLImageElement;
                  if (target.src.includes('logo.png')) {
                    target.src = '/logo.jpg';
                  } else if (target.src.includes('logo.jpg')) {
                    target.src = '/logo.svg';
                  }
                }}
              />
            </div>
          </div>

          {/* 中文标题 - 美年大健康 */}
          <div className="mb-3">
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="text-red-600 drop-shadow-sm">美年</span>
              <span className="text-blue-800 drop-shadow-sm">大健康</span>
            </h1>
          </div>

          {/* 英文标题 - Health 100 */}
          <div className="mb-4">
            <h2 className="text-xl font-bold text-blue-800 tracking-wider drop-shadow-sm">
              HEALTH <span className="ml-2">100</span>
            </h2>
          </div>

          {/* 系统名称 */}
          <div className="pt-4 border-t border-slate-200/50">
            <p className="text-sm font-medium text-slate-600">政策文件对比系统</p>
          </div>
        </div>

        {/* 登录表单 */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-white/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-slate-700 mb-2.5">
                用户名
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
                  placeholder="请输入用户名"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2.5">
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
                  placeholder="请输入密码"
                  disabled={isLoading}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50/90 border-2 border-red-200 px-4 py-3 text-sm text-red-700 font-medium flex items-center gap-2">
                <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 text-white py-4 rounded-xl font-bold text-base hover:from-blue-700 hover:via-blue-800 hover:to-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-500/50 focus:ring-offset-2 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  登录中...
                </span>
              ) : (
                "登录"
              )}
            </button>
          </form>
        </div>

        {/* 底部提示 */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-xs text-slate-600 font-medium">请输入您的账号和密码进行登录</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/80 backdrop-blur-sm border border-slate-200/50 shadow-sm">
            <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-xs text-slate-700 font-medium">
              测试账号：<span className="text-blue-700 font-semibold">admin</span> / 
              密码：<span className="text-blue-700 font-semibold">123456</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

