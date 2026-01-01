"use client";

import { useState, Fragment, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useFileContext, ComparisonRow, ComparisonStructuredData, FileInfo } from "@/contexts/file-context";
import { formatFileSize } from "@/lib/city-matcher";
import { getCozeTokenClient } from "@/lib/coze-config";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Toast提示工具函数
function showToast(message: string, type: "success" | "error" | "info" = "info") {
  if (typeof window === "undefined") return;
  
  const toast = document.createElement("div");
  const bgColor = type === "success" ? "bg-emerald-500" : type === "error" ? "bg-red-500" : "bg-slate-900";
  toast.className = `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] ${bgColor} text-white px-6 py-4 rounded-lg shadow-xl text-sm`;
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
  file: FileInfo | null;
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
          className="font-medium text-left text-sm leading-tight text-slate-700 hover:text-blue-600 cursor-pointer w-full"
          title={`点击打开: ${file.name}`}
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
        showToast("对比结果已复制到剪贴板", "success");
      } catch (err) {
        // 降级方案
        const textArea = document.createElement("textarea");
        textArea.value = markdownContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        showToast("对比结果已复制到剪贴板", "success");
      }
    };

    // 导出PDF（功能暂时移除）
    const handleExportPDF = () => {
      showToast("PDF导出功能暂时不可用，正在优化中", "info");
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

// 标签悬浮提示组件（显示对应内容的详情）
function TagTooltip({
  content,
  title,
  tagRef,
  isHovered,
}: {
  content: string[];
  title: string;
  tagRef: React.RefObject<HTMLButtonElement>;
  isHovered: boolean;
}) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isHovered && tagRef.current && typeof window !== "undefined") {
      const rect = tagRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right + window.scrollX - 384, // 384px 是悬浮窗宽度，右对齐
      });
    }
  }, [isHovered, tagRef]);

  const tooltipContent = isHovered && content.length > 0 && typeof window !== "undefined" ? (
    createPortal(
      <div
        className="fixed z-[9999] w-96 p-3 bg-white border border-slate-200 rounded-lg shadow-xl text-xs text-slate-700 pointer-events-none max-h-96 overflow-y-auto"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        <div className="font-semibold mb-2">{title}：</div>
        <ul className="space-y-1.5">
          {content.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0">•</span>
              <span className="flex-1 break-words">{item}</span>
            </li>
          ))}
        </ul>
      </div>,
      document.body
    )
  ) : null;

  return tooltipContent;
}

// 对比结果展示组件（只显示标签，可点击展开，悬浮显示详情）
function ComparisonResultDisplay({
  structured,
  onExpandToggle,
}: {
  structured: ComparisonStructuredData;
  onExpandToggle: () => void;
}) {
  const { statistics, added, modified, deleted } = structured;
  const [hoveredTag, setHoveredTag] = useState<"added" | "modified" | "deleted" | null>(null);
  const addedRef = useRef<HTMLButtonElement>(null);
  const modifiedRef = useRef<HTMLButtonElement>(null);
  const deletedRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex flex-row flex-wrap items-center gap-2">
      {statistics.totalAdded > 0 && (
        <>
          <button
            ref={addedRef}
            onClick={onExpandToggle}
            onMouseEnter={() => setHoveredTag("added")}
            onMouseLeave={() => setHoveredTag(null)}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <span className="font-semibold">+{statistics.totalAdded}</span>
            <span>新增</span>
          </button>
          <TagTooltip
            content={added}
            title="新增内容"
            tagRef={addedRef}
            isHovered={hoveredTag === "added"}
          />
        </>
      )}
      {statistics.totalModified > 0 && (
        <>
          <button
            ref={modifiedRef}
            onClick={onExpandToggle}
            onMouseEnter={() => setHoveredTag("modified")}
            onMouseLeave={() => setHoveredTag(null)}
            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <span className="font-semibold">~{statistics.totalModified}</span>
            <span>修改</span>
          </button>
          <TagTooltip
            content={modified}
            title="修改内容"
            tagRef={modifiedRef}
            isHovered={hoveredTag === "modified"}
          />
        </>
      )}
      {statistics.totalDeleted > 0 && (
        <>
          <button
            ref={deletedRef}
            onClick={onExpandToggle}
            onMouseEnter={() => setHoveredTag("deleted")}
            onMouseLeave={() => setHoveredTag(null)}
            className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs text-red-700 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
          >
            <span className="font-semibold">-{statistics.totalDeleted}</span>
            <span>删除</span>
          </button>
          <TagTooltip
            content={deleted}
            title="删除内容"
            tagRef={deletedRef}
            isHovered={hoveredTag === "deleted"}
          />
        </>
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

  const { added, modified, deleted, summary } = structured;

  return (
    <tr className="bg-slate-50/50">
      <td colSpan={6} className="px-4 py-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {/* 摘要显示 - 顶部 */}
          {summary && (
            <div className="mb-4 pb-4 border-b border-slate-200">
              <div className="font-semibold mb-2 text-sm text-slate-700">摘要：</div>
              <div className="text-sm text-slate-600 leading-relaxed">{summary}</div>
            </div>
          )}
          
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
      showToast("对比结果已复制到剪贴板", "success");
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = markdownContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showToast("对比结果已复制到剪贴板", "success");
    }
  };

  const handleExportPDF = () => {
    showToast("PDF导出功能暂时不可用，正在优化中", "info");
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
            <div className="overflow-x-auto">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
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
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-4">
                      <table className="min-w-full border-collapse border border-slate-300 text-sm" {...props} />
                    </div>
                  ),
                  thead: ({ node, ...props }) => (
                    <thead className="bg-slate-100" {...props} />
                  ),
                  tbody: ({ node, ...props }) => (
                    <tbody {...props} />
                  ),
                  tr: ({ node, ...props }) => (
                    <tr className="border-b border-slate-200 hover:bg-slate-50" {...props} />
                  ),
                  th: ({ node, ...props }) => (
                    <th className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-900" {...props} />
                  ),
                  td: ({ node, ...props }) => (
                    <td className="border border-slate-300 px-4 py-2 text-slate-700" {...props} />
                  ),
                }}
              >
                {markdownContent || "暂无详细内容"}
              </ReactMarkdown>
            </div>
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

  const handleFilePreview = (file: FileInfo) => {
    const fileUrl = file.file_url || file.url;
    if (fileUrl) {
      window.open(fileUrl, "_blank");
    } else {
      showToast("文件预览链接不可用", "error");
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
      
      // 文件大小限制：20MB
      const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
      if (file.size > MAX_FILE_SIZE) {
        showToast(`文件大小超过限制（最大 20MB），当前文件：${formatFileSize(file.size)}`, "error");
        return;
      }
      
      // 生成临时ID
      const tempId = `${Date.now()}-${Math.random()}`;
      
      // 直接使用当前行的city，不进行城市匹配校验
      const city = rowId;

      // 创建文件信息
      const fileInfo = {
        id: tempId,
        file_url: "",
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
          file_url: data.file_url,
          success: data.success,
        });

        // 输出文件访问地址
        if (data.success && data.file_url) {
          console.log(`✅ 文件上传成功！访问地址: ${data.file_url}`);
        }

        if (!response.ok || !data.success) {
          // 区分不同类型的错误
          let errorMessage = "上传失败";
          if (!response.ok) {
            if (response.status === 401) {
              errorMessage = "认证失败，请检查API Token";
            } else if (response.status === 413) {
              errorMessage = "文件过大，请选择小于 20MB 的文件";
            } else if (response.status >= 500) {
              errorMessage = "服务器错误，请稍后重试";
            } else if (data.error_source === "七牛云") {
              errorMessage = `七牛云错误: ${data.message || "未知错误"}`;
            } else if (data.error_source === "扣子API") {
              errorMessage = `扣子API错误: ${data.message || "未知错误"}`;
            } else {
              errorMessage = data.message || `上传失败 (${response.status})`;
            }
          } else {
            errorMessage = data.message || "上传失败";
          }
          throw new Error(errorMessage);
        }

        // 更新文件信息（创建新对象）
        if (!data.file_url) {
          throw new Error("上传成功但未返回文件URL");
        }

        const updatedFileInfo = {
          ...fileInfo,
          file_url: data.file_url,
          url: data.file_url,
          uploadStatus: "success" as const,
        };

        // 记录更新后的文件信息（仅开发环境）
        if (process.env.NODE_ENV === 'development') {
          console.log("对比列表更新文件信息:", {
            fileName: file.name,
            fileId: updatedFileInfo.id,
            fileUrl: updatedFileInfo.file_url,
            city: updatedFileInfo.city,
            type: updatedFileInfo.type,
            fullInfo: updatedFileInfo,
          });
        }

        // 更新文件（通过重新添加覆盖）
        addFile(updatedFileInfo);
      } catch (error: any) {
        // 更新为错误状态（创建新对象）
        let errorMessage = "上传失败";
        if (error instanceof TypeError && error.message.includes("fetch")) {
          errorMessage = "网络错误，请检查网络连接";
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        const errorFileInfo = {
          ...fileInfo,
          uploadStatus: "error" as const,
          error: errorMessage,
        };
        addFile(errorFileInfo);
      }
    };
    input.click();
  };

  const handleCompare = async (row: ComparisonRow) => {
    if (!row.thisYearFile || !row.lastYearFile) {
      showToast("请先上传新年度和旧年度的文件", "error");
      return;
    }

    const oldFileUrl = row.lastYearFile.file_url || row.lastYearFile.url;
    const newFileUrl = row.thisYearFile.file_url || row.thisYearFile.url;

    if (!oldFileUrl || !newFileUrl) {
      showToast("文件尚未上传完成，请稍候", "info");
      return;
    }

    const oldFileName = row.lastYearFile.name || "";
    const newFileName = row.thisYearFile.name || "";

    if (!oldFileName || !newFileName) {
      showToast("文件名称信息缺失", "error");
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
          file1_url: oldFileUrl,
          file2_url: newFileUrl,
          oldFileName: oldFileName,
          newFileName: newFileName,
        }),
      });

      const data = await response.json();

      // 记录对比接口的原始返回
      console.log("政策单独对比 - 接口原始返回:", {
        rowId: row.id,
        company: row.company,
        file1_url: oldFileUrl,
        file2_url: newFileUrl,
        responseStatus: response.status,
        responseOk: response.ok,
        rawResponse: JSON.stringify(data, null, 2),
        success: data.success,
        hasData: !!data.data,
        executeId: data.execute_id,
        debugUrl: data.debug_url,
      });

      if (!response.ok || !data.success) {
        // 区分不同类型的错误
        let errorMessage = "对比失败";
        if (!response.ok) {
          if (response.status === 401) {
            errorMessage = "认证失败，请检查API Token";
          } else if (response.status >= 500) {
            errorMessage = "服务器错误，请稍后重试";
          } else if (data.error_source === "扣子API") {
            errorMessage = `扣子API错误: ${data.message || "未知错误"}`;
          } else {
            errorMessage = data.message || `对比失败 (${response.status})`;
          }
        } else {
          errorMessage = data.message || "对比失败";
        }
        
        console.error("政策单独对比失败:", {
          rowId: row.id,
          error: errorMessage,
          fullError: data,
        });
        throw new Error(errorMessage);
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
    const hasThisYearUrl = hasBothFiles && (row.thisYearFile!.file_url || row.thisYearFile!.url);
    const hasLastYearUrl = hasBothFiles && (row.lastYearFile!.file_url || row.lastYearFile!.url);
    const hasBothFileIds = hasThisYearUrl && hasLastYearUrl;

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

      {/* 桌面端：表格布局 */}
      <div className="hidden md:block overflow-auto">
        <table className="min-w-full text-left text-sm" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-white text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 font-medium" style={{ width: "120px" }}>分公司</th>
              <th className="px-4 py-3 font-medium" style={{ width: "160px" }}>旧年度文件</th>
              <th className="px-4 py-3 font-medium" style={{ width: "160px" }}>新年度文件</th>
              <th className="px-4 py-3 font-medium" style={{ width: "100px" }}>对比状态</th>
              <th className="px-4 py-3 font-medium">对比结果（同一行）</th>
              <th className="px-4 py-3 font-medium text-right" style={{ width: "200px" }}>操作</th>
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
                          const hasThisYearUrl = !!(row.thisYearFile?.file_url || row.thisYearFile?.url);
                          const hasLastYearUrl = !!(row.lastYearFile?.file_url || row.lastYearFile?.url);
                          
                          if (hasThisYear && hasLastYear) {
                            if (process.env.NODE_ENV === 'development') {
                              console.log(`行 ${row.id} 文件状态检查:`, {
                              company: row.company,
                              hasThisYearFile: hasThisYear,
                              hasLastYearFile: hasLastYear,
                              thisYearFileUrl: row.thisYearFile?.file_url || row.thisYearFile?.url || "无",
                              lastYearFileUrl: row.lastYearFile?.file_url || row.lastYearFile?.url || "无",
                              thisYearFile: row.thisYearFile,
                              lastYearFile: row.lastYearFile,
                              canCompare: hasThisYearUrl && hasLastYearUrl,
                              });
                            }
                          }
                          
                          return hasThisYear && hasLastYear && hasThisYearUrl && hasLastYearUrl ? (
                            <>
                              <button
                                onClick={() => handleCompare(row)}
                                disabled={row.comparisonStatus === "comparing"}
                                className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                政策对比
                              </button>
                              <button
                                onClick={() => showToast("该功能正在开发中", "info")}
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
                                if (process.env.NODE_ENV === 'development') {
                                  console.log("按钮被禁用，文件状态:", {
                                    hasThisYear,
                                    hasLastYear,
                                    hasThisYearUrl,
                                    hasLastYearUrl,
                                    thisYearFile: row.thisYearFile,
                                    lastYearFile: row.lastYearFile,
                                  });
                                }
                              }}
                              disabled={true}
                              className="rounded-xl bg-slate-200 px-3 py-1.5 text-xs text-slate-400 cursor-not-allowed"
                              title={`请先上传新年度和旧年度的文件。状态：新年度文件${hasThisYear ? "✓" : "✗"}，旧年度文件${hasLastYear ? "✓" : "✗"}，新年度URL${hasThisYearUrl ? "✓" : "✗"}，旧年度URL${hasLastYearUrl ? "✓" : "✗"}`}
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

      {/* 移动端：卡片布局 */}
      <div className="md:hidden divide-y divide-slate-200">
        {sortedComparisons.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400">
            暂无文件，请先上传文件
          </div>
        ) : (
          sortedComparisons.map((row) => {
            const displayCompany = row.company.startsWith("未知_") ? "未知" : row.company;
            const hasThisYear = !!row.thisYearFile;
            const hasLastYear = !!row.lastYearFile;
            const hasThisYearUrl = !!(row.thisYearFile?.file_url || row.thisYearFile?.url);
            const hasLastYearUrl = !!(row.lastYearFile?.file_url || row.lastYearFile?.url);
            const canCompare = hasThisYear && hasLastYear && hasThisYearUrl && hasLastYearUrl;

            return (
              <div key={row.id} className="p-4 space-y-3">
                <div className="font-semibold text-sm">{displayCompany}</div>
                
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">旧年度文件</div>
                    <FileDisplay
                      file={row.lastYearFile}
                      type="lastYear"
                      onDelete={() => row.lastYearFile && handleFileDelete(row.lastYearFile.id)}
                      onPreview={() => row.lastYearFile && handleFilePreview(row.lastYearFile)}
                      onUpload={() => handleFileUpload(row.id, "lastYear")}
                    />
                  </div>
                  
                  <div>
                    <div className="text-xs text-slate-500 mb-1">新年度文件</div>
                    <FileDisplay
                      file={row.thisYearFile}
                      type="thisYear"
                      onDelete={() => row.thisYearFile && handleFileDelete(row.thisYearFile.id)}
                      onPreview={() => row.thisYearFile && handleFilePreview(row.thisYearFile)}
                      onUpload={() => handleFileUpload(row.id, "thisYear")}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-1">对比状态</div>
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
                </div>

                {row.comparisonStatus === "done" && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">对比结果</div>
                    {row.comparisonStructured && row.isJsonFormat ? (
                      <ComparisonResultDisplay
                        structured={row.comparisonStructured}
                        onExpandToggle={() => toggleCards(row.id)}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">对比完成</span>
                        <button
                          onClick={() => setDetailModal({ open: true, row })}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          查看详情
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <div className="text-xs text-slate-500 mb-1">操作</div>
                  <div className="flex flex-wrap gap-2">
                    {canCompare ? (
                      <>
                        <button
                          onClick={() => handleCompare(row)}
                          disabled={row.comparisonStatus === "comparing"}
                          className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          政策对比
                        </button>
                        <button
                          onClick={() => showToast("该功能正在开发中", "info")}
                          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          佣金对比
                        </button>
                        {row.comparisonStructured && row.isJsonFormat && (
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
                        )}
                      </>
                    ) : (
                      <button
                        disabled={true}
                        className="rounded-xl bg-slate-200 px-3 py-1.5 text-xs text-slate-400 cursor-not-allowed"
                      >
                        政策对比
                      </button>
                    )}
                  </div>
                </div>

                {/* 展开的卡片（移动端） */}
                {expandedCards.has(row.id) && row.comparisonStructured && row.isJsonFormat && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                    {row.comparisonStructured.summary && (
                      <div className="mb-4 pb-4 border-b border-slate-200">
                        <div className="font-semibold mb-2 text-sm text-slate-700">摘要：</div>
                        <div className="text-sm text-slate-600 leading-relaxed">{row.comparisonStructured.summary}</div>
                      </div>
                    )}
                    <div className="flex flex-col gap-3 mb-3">
                      {row.comparisonStructured.added.length > 0 && (
                        <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-3">
                          <div className="font-semibold mb-2 text-sm text-emerald-700 flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 text-xs font-bold">+</span>
                            新增内容 ({row.comparisonStructured.added.length}项)
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-700 max-h-64 overflow-y-auto">
                            {row.comparisonStructured.added.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-emerald-600 mt-0.5 flex-shrink-0">•</span>
                                <span className="flex-1 break-words">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {row.comparisonStructured.modified.length > 0 && (
                        <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-3">
                          <div className="font-semibold mb-2 text-sm text-blue-700 flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold">~</span>
                            修改内容 ({row.comparisonStructured.modified.length}项)
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-700 max-h-64 overflow-y-auto">
                            {row.comparisonStructured.modified.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-blue-600 mt-0.5 flex-shrink-0">•</span>
                                <span className="flex-1 break-words">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {row.comparisonStructured.deleted.length > 0 && (
                        <div className="rounded-lg border-2 border-red-200 bg-red-50/50 p-3">
                          <div className="font-semibold mb-2 text-sm text-red-700 flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-200 text-red-800 text-xs font-bold">-</span>
                            删除内容 ({row.comparisonStructured.deleted.length}项)
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-700 max-h-64 overflow-y-auto">
                            {row.comparisonStructured.deleted.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-red-600 mt-0.5 flex-shrink-0">•</span>
                                <span className="flex-1 break-words">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-end">
                        <button
                          onClick={() => toggleCards(row.id)}
                          className="text-xs text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"
                        >
                          收起
                        </button>
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => setDetailModal({ open: true, row })}
                          className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-300 hover:bg-blue-50"
                        >
                          查看完整报告
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
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
