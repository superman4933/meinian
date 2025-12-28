"use client";

import { useState, Fragment, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useFileContext, ComparisonRow, ComparisonStructuredData } from "@/contexts/file-context";
import { formatFileSize } from "@/lib/city-matcher";
import { getCozeTokenClient, getPolicyPrompt } from "@/lib/coze-config";
import ReactMarkdown from "react-markdown";

// Toast提示工具函数
function showToast(message: string) {
  if (typeof window === "undefined") return;
  
  const toast = document.createElement("div");
  toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-slate-900 text-white px-6 py-4 rounded-lg shadow-xl text-sm";
  toast.textContent = message;
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.3s";
  document.body.appendChild(toast);
  
  // 淡入动画
  setTimeout(() => {
    toast.style.opacity = "1";
  }, 10);
  
  // 3秒后淡出并移除
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 2700);
}

function FileDisplay({
  file,
  type,
  onDelete,
  onPreview,
  onUpload,
}: {
  file: any;
  type: "thisYear" | "lastYear";
  onDelete: () => void;
  onPreview: () => void;
  onUpload: () => void;
}) {
  if (!file) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-xs">—</span>
        <div className="flex-1">
          <div className="font-medium text-slate-400 text-xs">未上传</div>
          <button
            onClick={onUpload}
            className="text-xs text-blue-600 hover:text-blue-800 mt-1"
          >
            点击上传
          </button>
        </div>
      </div>
    );
  }

  if (file.uploadStatus === "uploading") {
    return (
      <div className="flex items-start gap-2">
        <div className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 flex-shrink-0">
          <svg className="animate-spin h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <div className="flex-1 min-w-0" style={{ width: "140px", maxWidth: "140px" }}>
          <div 
            className="font-medium text-sm leading-tight"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
              textOverflow: "ellipsis",
            }}
          >
            {file.name}
          </div>
          <div className="text-xs text-blue-600 mt-1">上传中...</div>
        </div>
      </div>
    );
  }

  if (file.uploadStatus === "error") {
    return (
      <div className="flex items-start gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-red-100 flex-shrink-0 text-xs">⚠️</span>
        <div className="flex-1 min-w-0" style={{ width: "140px", maxWidth: "140px" }}>
          <div 
            className="font-medium text-red-600 text-sm leading-tight"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
              textOverflow: "ellipsis",
            }}
          >
            {file.name}
          </div>
          <div className="text-xs text-red-500 mt-1">{file.error || "上传失败"}</div>
        </div>
        <button
          onClick={onDelete}
          className="text-xs text-red-600 hover:text-red-800 px-2 py-1 flex-shrink-0"
        >
          删除
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 group">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 flex-shrink-0 text-xs">📄</span>
      <div className="flex-1 min-w-0" style={{ width: "140px", maxWidth: "140px" }}>
        <button
          onClick={onPreview}
          className="font-medium text-left hover:text-blue-600 block w-full text-sm leading-tight"
          title={file.name}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            wordBreak: "break-word",
            textOverflow: "ellipsis",
          }}
        >
          {file.name}
        </button>
        <div className="text-xs text-slate-500 mt-1">{file.sizeFormatted}</div>
      </div>
      <button
        onClick={onDelete}
        className="text-xs text-slate-400 hover:text-red-600 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        title="删除文件"
      >
        删除
      </button>
    </div>
  );
}

function PreviewRow({
  row,
  isOpen,
  onToggle,
}: {
  row: ComparisonRow;
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (!isOpen) return null;

  if (row.comparisonStatus === "comparing") {
    return (
      <tr className="bg-slate-50/50">
        <td colSpan={6} className="px-4 py-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
            <div className="inline-flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium text-blue-700">对比中，请稍候...</span>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  if (row.comparisonStatus === "done" && row.comparisonResult) {
    // 提取 markdown 内容
    let markdownContent = "";
    
    if (typeof row.comparisonResult === "string") {
      markdownContent = row.comparisonResult;
    } else if (row.comparisonResult && typeof row.comparisonResult === "object") {
      // 如果结果中有 markdown 字段，优先使用
      if ((row.comparisonResult as any).markdown) {
        markdownContent = (row.comparisonResult as any).markdown;
      } else if ((row.comparisonResult as any).data) {
        markdownContent = typeof (row.comparisonResult as any).data === "string" 
          ? (row.comparisonResult as any).data 
          : JSON.stringify((row.comparisonResult as any).data);
      } else {
        markdownContent = JSON.stringify(row.comparisonResult, null, 2);
      }
    }

    // 复制功能
    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(markdownContent);
        alert("对比结果已复制到剪贴板");
      } catch (err) {
        // 降级方案
        const textArea = document.createElement("textarea");
        textArea.value = markdownContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        alert("对比结果已复制到剪贴板");
      }
    };

    // 导出PDF（功能暂时移除）
    const handleExportPDF = () => {
      alert("PDF导出功能暂时不可用，正在优化中");
    };


    return (
      <tr className="bg-slate-50/50">
        <td colSpan={6} className="px-4 py-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">对比结果</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1"
                  title="复制对比结果"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  复制
                </button>
                <button
                  onClick={handleExportPDF}
                  className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1"
                  title="导出PDF"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  导出PDF
                </button>
                <button onClick={onToggle} className="text-xs text-slate-500 hover:text-slate-700">
                  收起
                </button>
              </div>
            </div>
            <div className="prose prose-sm max-w-none text-slate-700">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-lg font-semibold mt-3 mb-2" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-base font-semibold mt-2 mb-1" {...props} />,
                  h4: ({ node, ...props }) => <h4 className="text-sm font-semibold mt-2 mb-1" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                  li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                  em: ({ node, ...props }) => <em className="italic" {...props} />,
                  code: ({ node, ...props }) => (
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono" {...props} />
                  ),
                  pre: ({ node, ...props }) => (
                    <pre className="bg-slate-100 p-3 rounded overflow-x-auto mb-2" {...props} />
                  ),
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-slate-300 pl-4 italic my-2" {...props} />
                  ),
                }}
              >
                {markdownContent}
              </ReactMarkdown>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  if (row.comparisonStatus === "error") {
    return (
      <tr className="bg-slate-50/50">
        <td colSpan={6} className="px-4 py-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm text-red-700">
              <strong>对比失败：</strong>
              {row.comparisonError || "未知错误"}
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return null;
}

// 摘要悬浮提示组件（使用 Portal 渲染到 body，避免被表格容器遮挡）
function SummaryTooltip({
  summary,
  rowId,
  onButtonClick,
}: {
  summary?: string;
  rowId: string;
  onButtonClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isHovered && buttonRef.current && typeof window !== "undefined") {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right + window.scrollX - 384, // 384px 是悬浮窗宽度，右对齐
      });
    }
  }, [isHovered]);

  const tooltipContent = isHovered && summary && typeof window !== "undefined" ? (
    createPortal(
      <div
        className="fixed z-[9999] w-96 p-3 bg-white border border-slate-200 rounded-lg shadow-xl text-xs text-slate-700 pointer-events-none"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        <div className="font-semibold mb-1">摘要：</div>
        <div>{summary}</div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={onButtonClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
      >
        查看详情
      </button>
      {tooltipContent}
    </>
  );
}

// 对比结果展示组件（只显示标签，可点击展开）
function ComparisonResultDisplay({
  structured,
  onExpandToggle,
}: {
  structured: ComparisonStructuredData;
  onExpandToggle: () => void;
}) {
  const { statistics } = structured;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {statistics.totalAdded > 0 && (
        <button
          onClick={onExpandToggle}
          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
        >
          <span className="font-semibold">+{statistics.totalAdded}</span>
          <span>新增</span>
        </button>
      )}
      {statistics.totalModified > 0 && (
        <button
          onClick={onExpandToggle}
          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
        >
          <span className="font-semibold">~{statistics.totalModified}</span>
          <span>修改</span>
        </button>
      )}
      {statistics.totalDeleted > 0 && (
        <button
          onClick={onExpandToggle}
          className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs text-red-700 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
        >
          <span className="font-semibold">-{statistics.totalDeleted}</span>
          <span>删除</span>
        </button>
      )}
    </div>
  );
}

// 对比结果卡片展开行组件（在表格的展开行中显示）
function ComparisonCardsRow({
  structured,
  isOpen,
  onToggle,
  onViewFullReport,
}: {
  structured: ComparisonStructuredData;
  isOpen: boolean;
  onToggle: () => void;
  onViewFullReport: () => void;
}) {
  if (!isOpen) return null;

  const { added, modified, deleted } = structured;

  return (
    <tr className="bg-slate-50/50">
      <td colSpan={6} className="px-4 py-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {/* 卡片内容 */}
          <div className="flex flex-row gap-3 mb-3">
            {/* 新增内容卡片 */}
            {added.length > 0 && (
              <div className="flex-1 min-w-[280px] rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-3">
                <div className="font-semibold mb-2 text-sm text-emerald-700 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 text-xs font-bold">
                    +
                  </span>
                  新增内容 ({added.length}项)
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700 max-h-64 overflow-y-auto">
                  {added.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5 flex-shrink-0">•</span>
                      <span className="flex-1 break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 修改内容卡片 */}
            {modified.length > 0 && (
              <div className="flex-1 min-w-[280px] rounded-lg border-2 border-blue-200 bg-blue-50/50 p-3">
                <div className="font-semibold mb-2 text-sm text-blue-700 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold">
                    ~
                  </span>
                  修改内容 ({modified.length}项)
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700 max-h-64 overflow-y-auto">
                  {modified.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5 flex-shrink-0">•</span>
                      <span className="flex-1 break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 删除内容卡片 */}
            {deleted.length > 0 && (
              <div className="flex-1 min-w-[280px] rounded-lg border-2 border-red-200 bg-red-50/50 p-3">
                <div className="font-semibold mb-2 text-sm text-red-700 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-200 text-red-800 text-xs font-bold">
                    -
                  </span>
                  删除内容 ({deleted.length}项)
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700 max-h-64 overflow-y-auto">
                  {deleted.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-red-600 mt-0.5 flex-shrink-0">•</span>
                      <span className="flex-1 break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 收起按钮 - 另起一行 */}
          <div className="flex justify-end mb-3">
            <button
              onClick={onToggle}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              收起
            </button>
          </div>

          {/* 查看完整报告按钮 - 在底部右侧 */}
          <div className="flex justify-end">
            <button
              onClick={onViewFullReport}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors"
            >
              查看完整报告
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// 全屏详情对话框组件
function DetailModal({
  row,
  isOpen,
  onClose,
}: {
  row: ComparisonRow | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !row) return null;

  let markdownContent = "";
  let isJsonFormat = row.isJsonFormat || false;

  if (isJsonFormat && row.comparisonStructured) {
    markdownContent = row.comparisonStructured.detailed || "";
  } else if (typeof row.comparisonResult === "string") {
    markdownContent = row.comparisonResult;
  } else if (row.comparisonResult && typeof row.comparisonResult === "object") {
    if ((row.comparisonResult as any).markdown) {
      markdownContent = (row.comparisonResult as any).markdown;
    } else if ((row.comparisonResult as any).data) {
      markdownContent = typeof (row.comparisonResult as any).data === "string"
        ? (row.comparisonResult as any).data
        : JSON.stringify((row.comparisonResult as any).data);
    } else {
      markdownContent = JSON.stringify(row.comparisonResult, null, 2);
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdownContent);
      alert("对比结果已复制到剪贴板");
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = markdownContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("对比结果已复制到剪贴板");
    }
  };

  const handleExportPDF = () => {
    alert("PDF导出功能暂时不可用，正在优化中");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">
            对比详情 - {row.company.startsWith("未知_") ? "未知" : row.company}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              复制
            </button>
            <button
              onClick={handleExportPDF}
              className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              导出PDF
            </button>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 p-2"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="prose prose-sm max-w-none text-slate-700">
            <ReactMarkdown
              components={{
                h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-lg font-semibold mt-3 mb-2" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-base font-semibold mt-2 mb-1" {...props} />,
                h4: ({ node, ...props }) => <h4 className="text-sm font-semibold mt-2 mb-1" {...props} />,
                p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                em: ({ node, ...props }) => <em className="italic" {...props} />,
                code: ({ node, ...props }) => (
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono" {...props} />
                ),
                pre: ({ node, ...props }) => (
                  <pre className="bg-slate-100 p-3 rounded overflow-x-auto mb-2" {...props} />
                ),
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-4 border-slate-300 pl-4 italic my-2" {...props} />
                ),
              }}
            >
              {markdownContent || "暂无详细内容"}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ComparisonTableProps {
  filterStatus?: string;
}

export function ComparisonTable({ filterStatus = "全部状态" }: ComparisonTableProps) {
  const { comparisons, removeFile, updateComparison, addFile } = useFileContext();
  const [openPreviews, setOpenPreviews] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [detailModal, setDetailModal] = useState<{ open: boolean; row: ComparisonRow | null }>({
    open: false,
    row: null,
  });

  function togglePreview(id: string) {
    setOpenPreviews((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleCards(id: string) {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const handleFileDelete = (fileId: string) => {
    if (confirm("确定要删除这个文件吗？")) {
      removeFile(fileId);
    }
  };

  const handleFilePreview = (file: any) => {
    if (file.url) {
      window.open(file.url, "_blank");
    } else {
      alert("文件预览链接不可用");
    }
  };

  const handleFileUpload = async (rowId: string, type: "thisYear" | "lastYear") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.doc,.docx";
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const file = files[0];
      
      // 生成临时ID
      const tempId = `${Date.now()}-${Math.random()}`;
      
      // 直接使用当前行的city，不进行城市匹配校验
      const city = rowId;

      // 创建文件信息
      const fileInfo = {
        id: tempId,
        file_id: "",
        name: file.name,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
        city: city,
        type: type,
        uploadTime: new Date(),
        uploadStatus: "uploading" as const,
      };

      // 先添加到列表显示上传中状态
      addFile(fileInfo);

      try {
        // 上传到扣子
        const formData = new FormData();
        formData.append("file", file);

        // 获取token并添加到请求头
        const token = getCozeTokenClient();
        
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "x-coze-token": token,
          },
          body: formData,
        });

        const data = await response.json();

        // 记录上传响应数据
        console.log("对比列表文件上传响应数据:", {
          fileName: file.name,
          response: data,
          file_id: data.file_id,
          success: data.success,
        });

        if (!response.ok || !data.success) {
          throw new Error(data.message || "上传失败");
        }

        // 更新文件信息（创建新对象）
        const updatedFileInfo = {
          ...fileInfo,
          file_id: data.file_id || "",
          url: data.url || null,
          uploadStatus: "success" as const,
        };

        // 记录更新后的文件信息
        console.log("对比列表更新文件信息:", {
          fileName: file.name,
          fileId: updatedFileInfo.file_id,
          city: updatedFileInfo.city,
          type: updatedFileInfo.type,
          fullInfo: updatedFileInfo,
        });

        // 更新文件（通过重新添加覆盖）
        addFile(updatedFileInfo);
      } catch (error: any) {
        // 更新为错误状态（创建新对象）
        const errorFileInfo = {
          ...fileInfo,
          uploadStatus: "error" as const,
          error: error.message || "上传失败",
        };
        addFile(errorFileInfo);
      }
    };
    input.click();
  };

  const handleCompare = async (row: ComparisonRow) => {
    if (!row.thisYearFile || !row.lastYearFile) {
      alert("请先上传新年度和旧年度的文件");
      return;
    }

    if (!row.thisYearFile.file_id || !row.lastYearFile.file_id) {
      alert("文件尚未上传完成，请稍候");
      return;
    }

    updateComparison(row.id, { comparisonStatus: "comparing" });

    try {
      // 获取token并添加到请求头
      const token = getCozeTokenClient();
      
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-coze-token": token,
        },
        body: JSON.stringify({
          file1_id: row.lastYearFile.file_id,
          file2_id: row.thisYearFile.file_id,
          prompt: getPolicyPrompt(),
        }),
      });

      const data = await response.json();

      // 记录对比接口的原始返回
      console.log("政策单独对比 - 接口原始返回:", {
        rowId: row.id,
        company: row.company,
        file1_id: row.lastYearFile.file_id,
        file2_id: row.thisYearFile.file_id,
        responseStatus: response.status,
        responseOk: response.ok,
        rawResponse: JSON.stringify(data, null, 2),
        success: data.success,
        hasData: !!data.data,
        executeId: data.execute_id,
        debugUrl: data.debug_url,
      });

      if (!response.ok || !data.success) {
        console.error("政策单独对比失败:", {
          rowId: row.id,
          error: data.message || "对比失败",
          fullError: data,
        });
        throw new Error(data.message || "对比失败");
      }

      console.log("政策单独对比成功:", {
        rowId: row.id,
        company: row.company,
        resultData: data.data,
        markdown: data.markdown,
        structured: data.structured,
        isJsonFormat: data.isJsonFormat,
        resultType: typeof data.data,
      });

      // 保存结果（可能是结构化数据或原始内容）
      const resultContent = data.markdown || data.data || "对比完成";

      updateComparison(row.id, {
        comparisonStatus: "done",
        comparisonResult: resultContent,
        comparisonStructured: data.structured || undefined,
        isJsonFormat: data.isJsonFormat || false,
        comparisonError: undefined,
      });
    } catch (error: any) {
      updateComparison(row.id, {
        comparisonStatus: "error",
        comparisonError: error.message || "对比失败",
        comparisonResult: undefined,
      });
    }
  };

  // 过滤对比列表
  const filteredComparisons = comparisons.filter((row) => {
    const hasBothFiles = row.thisYearFile && row.lastYearFile;
    const hasBothFileIds = hasBothFiles && row.thisYearFile!.file_id && row.lastYearFile!.file_id;

    switch (filterStatus) {
      case "可比对":
        return hasBothFileIds && row.comparisonStatus !== "comparing";
      case "缺文件":
        return !hasBothFiles || !hasBothFileIds;
      case "已完成":
        return row.comparisonStatus === "done";
      case "全部状态":
      default:
        return true;
    }
  });

  // 按分公司名称排序
  const sortedComparisons = [...filteredComparisons].sort((a, b) =>
    a.company.localeCompare(b.company, "zh-CN")
  );

  return (
    <Fragment>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
        <div className="text-sm font-semibold">分公司文件对比列表（一行展示）</div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 font-medium">分公司</th>
              <th className="px-4 py-3 font-medium" style={{ width: "160px" }}>旧年度文件</th>
              <th className="px-4 py-3 font-medium" style={{ width: "160px" }}>新年度文件</th>
              <th className="px-4 py-3 font-medium">对比状态</th>
              <th className="px-4 py-3 font-medium">对比结果（同一行）</th>
              <th className="px-4 py-3 font-medium text-right">操作</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 bg-white">
            {sortedComparisons.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  暂无文件，请先上传文件
                </td>
              </tr>
            ) : (
              sortedComparisons.map((row) => {
                // 格式化分公司名称显示，如果是未知分公司（包含未知_ID格式），只显示"未知"
                const displayCompany = row.company.startsWith("未知_") ? "未知" : row.company;
                return (
                  <Fragment key={row.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{displayCompany}</td>

                    <td className="px-4 py-3" style={{ width: "160px" }}>
                      <FileDisplay
                        file={row.lastYearFile}
                        type="lastYear"
                        onDelete={() => row.lastYearFile && handleFileDelete(row.lastYearFile.id)}
                        onPreview={() => row.lastYearFile && handleFilePreview(row.lastYearFile)}
                        onUpload={() => handleFileUpload(row.id, "lastYear")}
                      />
                    </td>

                    <td className="px-4 py-3" style={{ width: "160px" }}>
                      <FileDisplay
                        file={row.thisYearFile}
                        type="thisYear"
                        onDelete={() => row.thisYearFile && handleFileDelete(row.thisYearFile.id)}
                        onPreview={() => row.thisYearFile && handleFilePreview(row.thisYearFile)}
                        onUpload={() => handleFileUpload(row.id, "thisYear")}
                      />
                    </td>

                    <td className="px-4 py-3">
                      {row.comparisonStatus === "none" && (
                        <span className="text-xs text-slate-500">未对比</span>
                      )}
                      {row.comparisonStatus === "comparing" && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          对比中
                        </span>
                      )}
                      {row.comparisonStatus === "done" && (
                        <span className="text-xs text-emerald-600">已完成</span>
                      )}
                      {row.comparisonStatus === "error" && (
                        <span className="text-xs text-red-600">失败</span>
                      )}
                    </td>

                    <td className="px-4 py-3" style={{ whiteSpace: 'normal' }}>
                      {row.comparisonStatus === "done" && row.comparisonStructured && row.isJsonFormat ? (
                        <ComparisonResultDisplay
                          structured={row.comparisonStructured}
                          onExpandToggle={() => toggleCards(row.id)}
                        />
                      ) : row.comparisonStatus === "done" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600">对比完成</span>
                          <button
                            onClick={() => setDetailModal({ open: true, row })}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            查看详情
                          </button>
                        </div>
                      ) : row.comparisonStatus === "error" ? (
                        <span className="rounded-full bg-red-50 px-2 py-1 text-xs text-red-700">
                          对比失败
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex gap-2">
                        {(() => {
                          // 调试日志：检查文件状态
                          const hasThisYear = !!row.thisYearFile;
                          const hasLastYear = !!row.lastYearFile;
                          const hasThisYearFileId = !!(row.thisYearFile?.file_id);
                          const hasLastYearFileId = !!(row.lastYearFile?.file_id);
                          
                          if (hasThisYear && hasLastYear) {
                            console.log(`行 ${row.id} 文件状态检查:`, {
                              company: row.company,
                              hasThisYearFile: hasThisYear,
                              hasLastYearFile: hasLastYear,
                              thisYearFileId: row.thisYearFile?.file_id || "无",
                              lastYearFileId: row.lastYearFile?.file_id || "无",
                              thisYearFile: row.thisYearFile,
                              lastYearFile: row.lastYearFile,
                              canCompare: hasThisYearFileId && hasLastYearFileId,
                            });
                          }
                          
                          return hasThisYear && hasLastYear && hasThisYearFileId && hasLastYearFileId ? (
                            <>
                              <button
                                onClick={() => handleCompare(row)}
                                disabled={row.comparisonStatus === "comparing"}
                                className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                政策对比
                              </button>
                              <button
                                onClick={() => showToast("该功能正在开发中")}
                                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                              >
                                佣金对比
                              </button>
                                 <SummaryTooltip
                                   summary={row.comparisonStructured?.summary}
                                   rowId={row.id}
                                   onButtonClick={() => {
                                     if (row.comparisonStructured && row.isJsonFormat) {
                                       toggleCards(row.id);
                                     } else {
                                       setDetailModal({ open: true, row });
                                     }
                                   }}
                                 />
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                console.log("按钮被禁用，文件状态:", {
                                  hasThisYear,
                                  hasLastYear,
                                  hasThisYearFileId,
                                  hasLastYearFileId,
                                  thisYearFile: row.thisYearFile,
                                  lastYearFile: row.lastYearFile,
                                });
                              }}
                              disabled={true}
                              className="rounded-xl bg-slate-200 px-3 py-1.5 text-xs text-slate-400 cursor-not-allowed"
                              title={`请先上传新年度和旧年度的文件。状态：新年度文件${hasThisYear ? "✓" : "✗"}，旧年度文件${hasLastYear ? "✓" : "✗"}，新年度file_id${hasThisYearFileId ? "✓" : "✗"}，旧年度file_id${hasLastYearFileId ? "✓" : "✗"}`}
                            >
                              政策对比
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                  {/* 对比结果卡片展开行 */}
                  {row.comparisonStatus === "done" && row.comparisonStructured && row.isJsonFormat && (
                    <ComparisonCardsRow
                      key={`cards-${row.id}`}
                      structured={row.comparisonStructured}
                      isOpen={expandedCards.has(row.id)}
                      onToggle={() => toggleCards(row.id)}
                      onViewFullReport={() => setDetailModal({ open: true, row })}
                    />
                  )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 flex items-center justify-between">
        <span>提示：只有"新年度+旧年度"齐全才可"单独比对 / 一键比对"。</span>
        <span>共 {sortedComparisons.length} 家分公司</span>
      </div>
    </section>

    {/* 全屏详情对话框 */}
    <DetailModal
      row={detailModal.row}
      isOpen={detailModal.open}
      onClose={() => setDetailModal({ open: false, row: null })}
    />
    </Fragment>
  );
}
