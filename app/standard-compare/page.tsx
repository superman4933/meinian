"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Login } from "@/components/login";
import { formatFileSize } from "@/lib/city-matcher";
import { getCozeTokenClient } from "@/lib/coze-config";
import { showToast } from "@/lib/toast";

// 标准项接口定义
interface StandardItem {
  id: number;
  name: string;
  status: "满足" | "部分满足" | "不满足" | "未提及" | "不适用" | "暂不核查";
  matched: boolean | null;
  evidence: string | null;
  analysis: string;
}

// 文件信息接口
interface FileInfo {
  id: string;
  name: string;
  size: number;
  sizeFormatted: string;
  file_url: string;
  uploadStatus: "uploading" | "success" | "error";
  compareStatus: "idle" | "comparing" | "success" | "error";
  compareResult: StandardItem[] | null;
  error?: string;
  uploadProgress: number;
  compareProgress: string;
}

export default function StandardComparePage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 检查登录状态
  useEffect(() => {
    const checkAutoLogin = async () => {
      if (typeof window === "undefined") return;

      const savedUsername = localStorage.getItem("savedUsername");
      const savedPassword = localStorage.getItem("savedPassword");

      if (savedUsername && savedPassword) {
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
            localStorage.removeItem("savedPassword");
          }
        } catch (err) {
          localStorage.removeItem("savedPassword");
        } finally {
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
    localStorage.removeItem("savedPassword");
    setUsername("");
    setIsLoggedIn(false);
  };

  // 并发控制函数：限制同时执行的任务数
  const limitConcurrency = async (
    tasks: (() => Promise<void>)[],
    limit: number
  ): Promise<void> => {
    const executing: Promise<void>[] = [];

    for (const task of tasks) {
      const promise = task().finally(() => {
        // 任务完成后从执行队列中移除
        const index = executing.indexOf(promise);
        if (index > -1) {
          executing.splice(index, 1);
        }
      });

      executing.push(promise);

      // 如果达到并发限制，等待至少一个任务完成
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }

    // 等待所有剩余任务完成
    await Promise.all(executing);
  };

  // 处理文件选择
  const handleFileSelect = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newFiles: File[] = Array.from(fileList);
    const totalFiles = files.length + newFiles.length;

    if (totalFiles > 20) {
      showToast(`最多只能上传20个文件，当前已有${files.length}个，本次选择了${newFiles.length}个`, "error");
      return;
    }

    // 添加新文件到列表
    const fileInfos: FileInfo[] = newFiles.map((file, index) => ({
      id: `${Date.now()}-${index}-${Math.random()}`,
      name: file.name,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      file_url: "",
      uploadStatus: "uploading" as const,
      compareStatus: "idle" as const,
      compareResult: null,
      uploadProgress: 0,
      compareProgress: "",
    }));

    setFiles((prev) => [...prev, ...fileInfos]);

    // 并发上传文件，限制同时最多5个
    const uploadTasks = fileInfos.map((fileInfo, index) => () => uploadFile(newFiles[index], fileInfo.id));
    await limitConcurrency(uploadTasks, 5);
  };

  // 上传文件到七牛云
  const uploadFile = async (file: File, fileId: string) => {
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_FILE_SIZE) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                uploadStatus: "error" as const,
                error: `文件大小超过限制（最大 20MB）`,
              }
            : f
        )
      );
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = getCozeTokenClient();

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "x-coze-token": token,
        },
        body: formData,
      });

      // 检查响应状态
      if (!response.ok) {
        let errorMessage = `上传失败 (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  uploadStatus: "error" as const,
                  error: errorMessage,
                }
              : f
          )
        );
        return;
      }

      const data = await response.json();

      if (data.success && data.file_url) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  file_url: data.file_url,
                  uploadStatus: "success" as const,
                  uploadProgress: 100,
                }
              : f
          )
        );

        // 上传成功后立即调用对比API（不等待，并行执行）
        compareFile(fileId, data.file_url).catch((error) => {
          console.error(`文件 ${fileId} 对比失败:`, error);
        });
      } else {
        const errorMessage = data.message || "上传失败，请重试";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  uploadStatus: "error" as const,
                  error: errorMessage,
                }
              : f
          )
        );
      }
    } catch (error: any) {
      // 区分网络错误和其他错误
      const errorMessage = error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")
        ? "网络连接失败，请检查网络后重试"
        : error.message || "上传失败，请稍后重试";
      
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                uploadStatus: "error" as const,
                error: errorMessage,
              }
            : f
        )
      );
    }
  };

  // 调用对比API
  const compareFile = async (fileId: string, file_url: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? {
              ...f,
              compareStatus: "comparing" as const,
              compareProgress: "正在调用对比API...",
            }
          : f
      )
    );

    try {
      const token = getCozeTokenClient();

      const response = await fetch("/api/standard-compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-coze-token": token,
        },
        body: JSON.stringify({ file_url }),
      });

      // 检查响应状态
      if (!response.ok) {
        let errorMessage = `请求失败 (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  compareStatus: "error" as const,
                  error: errorMessage,
                  compareProgress: "对比失败",
                }
              : f
          )
        );
        return;
      }

      const data = await response.json();

      if (data.success && data.structured && Array.isArray(data.structured)) {
        // 验证数据结构
        if (data.structured.length === 0) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    compareStatus: "error" as const,
                    error: "返回数据为空，请重试",
                    compareProgress: "对比失败",
                  }
                : f
            )
          );
          return;
        }

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  compareStatus: "success" as const,
                  compareResult: data.structured,
                  compareProgress: "对比完成",
                }
              : f
          )
        );
      } else {
        const errorMessage = data.message || (data.structured ? "返回数据格式不正确" : "对比失败");
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  compareStatus: "error" as const,
                  error: errorMessage,
                  compareProgress: "对比失败",
                }
              : f
          )
        );
      }
    } catch (error: any) {
      // 区分网络错误和其他错误
      const errorMessage = error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")
        ? "网络连接失败，请检查网络后重试"
        : error.message || "对比失败，请稍后重试";
      
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                compareStatus: "error" as const,
                error: errorMessage,
                compareProgress: "对比失败",
              }
            : f
        )
      );
    }
  };

  // 再次对比
  const handleRecompare = async (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file || !file.file_url) {
      showToast("文件URL不存在，无法重新对比", "error");
      return;
    }

    await compareFile(fileId, file.file_url);
  };

  // 删除文件
  const handleDelete = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // 获取所有标准项名称（从第一个成功的结果中提取）
  const getStandardNames = (): string[] => {
    const firstResult = files.find((f) => f.compareResult && f.compareResult.length > 0);
    if (firstResult && firstResult.compareResult) {
      return firstResult.compareResult.map((item) => item.name);
    }
    // 如果没有结果，返回默认的11个标准项名称（根据用户提供的示例）
    return [
      "季度目标or月度目标",
      "各板块业务增长率目标",
      "为了业务目标达成，制定针对性的激励政策",
      "全国型客户：AM区域经理",
      "系统大客户：系统负责人",
      "中小客户（暂不核查）",
      "团单二维表（折扣/客单价）",
      "区分新、老单提成",
      "渠道（三方）订单",
      "个检提成按照2026年降本目标下调",
      "分院创新加项：提成参照个检降低力度",
    ];
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4 animate-pulse">
            <svg className="h-8 w-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-lg font-semibold text-slate-700">正在加载...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const standardNames = getStandardNames();

  return (
    <>
      <Header username={username} onLogout={handleLogout} />
      <main className="mx-auto max-w-[1400px] px-4 py-6 space-y-4">
        {/* 返回首页按钮 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回首页
          </button>
          <div className="text-sm text-slate-500">
            已上传 {files.length} / 20 个文件
          </div>
        </div>

        {/* 文件上传区域 */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-slate-300 bg-slate-50 hover:border-slate-400"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          <div className="flex flex-col items-center gap-4">
            <svg className="h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div>
              <p className="text-lg font-semibold text-slate-700">批量上传政策文件</p>
              <p className="text-sm text-slate-500 mt-1">支持最多20个文件，支持拖拽上传</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              选择文件
            </button>
          </div>
        </div>

        {/* 对比结果表格 */}
        {files.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-300 px-4 py-3 text-left font-semibold text-slate-900 min-w-[200px] sticky left-0 bg-slate-100 z-10">
                      文件名
                    </th>
                    {standardNames.map((name, index) => (
                      <th
                        key={index}
                        className="border border-slate-300 px-4 py-3 text-left font-semibold text-slate-900 min-w-[180px]"
                      >
                        {name}
                      </th>
                    ))}
                    <th className="border border-slate-300 px-4 py-3 text-left font-semibold text-slate-900 min-w-[120px]">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="border border-slate-300 px-4 py-3 sticky left-0 bg-white z-10">
                        <div className="flex flex-col gap-1">
                          <div className="font-medium text-sm text-slate-700">{file.name}</div>
                          <div className="text-xs text-slate-500">{file.sizeFormatted}</div>
                          {/* 上传状态 */}
                          {file.uploadStatus === "uploading" && (
                            <div className="flex items-center gap-2 text-xs text-blue-600">
                              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              上传中...
                            </div>
                          )}
                          {file.uploadStatus === "error" && (
                            <div className="text-xs text-red-600">{file.error}</div>
                          )}
                          {/* 对比状态 */}
                          {file.compareStatus === "comparing" && (
                            <div className="flex items-center gap-2 text-xs text-blue-600">
                              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              {file.compareProgress || "对比中..."}
                            </div>
                          )}
                          {file.compareStatus === "error" && (
                            <div className="text-xs text-red-600">{file.error}</div>
                          )}
                        </div>
                      </td>
                      {standardNames.map((standardName, index) => {
                        const result = file.compareResult?.find((item) => item.name === standardName);
                        return (
                          <td key={index} className="border border-slate-300 px-4 py-3">
                            {result ? (
                              <div className="space-y-2 min-w-[200px]">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                                      result.status === "满足"
                                        ? "bg-green-100 text-green-700"
                                        : result.status === "部分满足"
                                        ? "bg-yellow-100 text-yellow-700"
                                        : result.status === "不满足"
                                        ? "bg-red-100 text-red-700"
                                        : result.status === "未提及"
                                        ? "bg-gray-100 text-gray-700"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {result.status}
                                  </span>
                                  {result.matched !== null && (
                                    <span
                                      className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                                        result.matched ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                                      }`}
                                    >
                                      {result.matched ? "✓ 匹配" : "✗ 不匹配"}
                                    </span>
                                  )}
                                </div>
                                {result.evidence && (
                                  <div className="group relative">
                                    <div className="text-xs text-slate-600 line-clamp-2 cursor-help">
                                      <span className="font-medium">依据：</span>
                                      {result.evidence}
                                    </div>
                                    {result.evidence.length > 50 && (
                                      <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-20 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-xl">
                                        {result.evidence}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {result.analysis && (
                                  <div className="group relative">
                                    <div className="text-xs text-slate-500 line-clamp-2 cursor-help">
                                      <span className="font-medium">分析：</span>
                                      {result.analysis}
                                    </div>
                                    {result.analysis.length > 50 && (
                                      <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-20 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-xl">
                                        {result.analysis}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : file.compareStatus === "comparing" ? (
                              <div className="flex items-center justify-center">
                                <svg className="h-4 w-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400">-</div>
                            )}
                          </td>
                        );
                      })}
                      <td className="border border-slate-300 px-4 py-3">
                        <div className="flex flex-col gap-2">
                          {file.file_url && (
                            <button
                              onClick={() => handleRecompare(file.id)}
                              disabled={file.compareStatus === "comparing"}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {file.compareStatus === "comparing" ? "对比中..." : "再次对比"}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(file.id)}
                            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100 transition-colors"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

