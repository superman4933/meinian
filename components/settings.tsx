"use client";

import { useState, useEffect } from "react";
import { getCozeToken, saveCozeToken, clearCozeToken, getPolicyPrompt, savePolicyPrompt, clearPolicyPrompt } from "@/lib/coze-config";

export function Settings() {
  const [token, setToken] = useState("");
  const [policyPrompt, setPolicyPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    // 加载已保存的token和提示词
    const savedToken = getCozeToken();
    const savedPrompt = getPolicyPrompt();
    setToken(savedToken);
    setPolicyPrompt(savedPrompt);
  }, []);

  const handleSave = () => {
    if (!token.trim()) {
      setMessage({ type: "error", text: "Token不能为空" });
      return;
    }

    if (!policyPrompt.trim()) {
      setMessage({ type: "error", text: "政策对比提示词不能为空" });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      saveCozeToken(token.trim());
      savePolicyPrompt(policyPrompt.trim());
      setMessage({ type: "success", text: "配置已保存" });
      
      // 3秒后清除提示
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "保存失败" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm("确定要重置为默认配置吗？")) {
      clearCozeToken();
      clearPolicyPrompt();
      const defaultToken = "sat_iVFZ9QcGxPajVuiZD6o89MGOZ9hiQL2rTGMIzUAxGy9rBvwegpaZDEqzeyoGY4Ic";
      const defaultPrompt = "请分析这两个政策文件的差异";
      setToken(defaultToken);
      setPolicyPrompt(defaultPrompt);
      saveCozeToken(defaultToken);
      savePolicyPrompt(defaultPrompt);
      setMessage({ type: "success", text: "已重置为默认配置" });
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    }
  };

  const tokenPreview = token
    ? `${token.substring(0, 15)}${"*".repeat(Math.max(0, token.length - 30))}${token.substring(token.length - 15)}`
    : "";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">扣子API配置</h2>
        <p className="text-sm text-slate-500">设置扣子API的访问令牌，用于文件上传和对比功能</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="coze-token" className="block text-sm font-medium text-slate-700 mb-2">
            扣子API Token
          </label>
          <div className="relative">
            <input
              id="coze-token"
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-slate-900 font-mono text-sm"
              placeholder="请输入扣子API Token"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title={showToken ? "隐藏" : "显示"}
            >
              {showToken ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {token && (
            <p className="mt-2 text-xs text-slate-500">
              当前Token预览: <span className="font-mono">{tokenPreview}</span>
            </p>
          )}
        </div>

        {message && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              message.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "保存中..." : "保存配置"}
          </button>
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            重置默认
          </button>
        </div>

        <div>
          <label htmlFor="policy-prompt" className="block text-sm font-medium text-slate-700 mb-2">
            政策对比提示词
          </label>
          <textarea
            id="policy-prompt"
            value={policyPrompt}
            onChange={(e) => setPolicyPrompt(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-slate-900 text-sm resize-none"
            placeholder="请输入政策对比的提示词，用于指导AI进行文件对比分析"
            disabled={isLoading}
          />
          <p className="mt-2 text-xs text-slate-500">
            提示词将用于政策文件对比，指导AI分析文件的差异和变化
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600">
          <p className="font-medium mb-1">提示：</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Token和提示词将保存在浏览器本地存储中</li>
            <li>更换浏览器或清除数据后需要重新设置</li>
            <li>Token用于调用扣子API的文件上传和对比功能</li>
            <li>提示词用于指导AI进行文件对比分析</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

