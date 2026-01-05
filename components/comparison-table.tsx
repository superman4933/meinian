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
  onDelete?: () => void;
  onPreview: () => void;
  onUpload?: () => void;
}) {
  if (!file) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-xs">—</span>
        <div className="flex-1">
          <div className="font-medium text-slate-400 text-xs">未上传</div>
          {onUpload && (
            <button
              onClick={onUpload}
              className="text-xs text-blue-600 hover:text-blue-800 mt-1"
            >
              点击上传
            </button>
          )}
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
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-xs text-red-600 hover:text-red-800 px-2 py-1 flex-shrink-0"
          >
            删除
          </button>
        )}
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
      {onDelete && (
        <button
          onClick={onDelete}
          className="text-xs text-slate-400 hover:text-red-600 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          title="删除文件"
        >
          删除
        </button>
      )}
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
        <td colSpan={7} className="px-4 py-4">
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
        <td colSpan={7} className="px-4 py-4">
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
        <td colSpan={7} className="px-4 py-4">
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
      <td colSpan={7} className="px-4 py-4">
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
  
  // 历史记录分页状态
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // 对比模式选择对话框状态
  const [compareModeModal, setCompareModeModal] = useState<{
    open: boolean;
    row: ComparisonRow | null;
  }>({
    open: false,
    row: null,
  });
  
  // 确认完成对话框状态
  const [verifyModal, setVerifyModal] = useState<{
    open: boolean;
    row: ComparisonRow | null;
  }>({
    open: false,
    row: null,
  });
  
  // 历史记录中正在对比的条目状态（key: record._id, value: ComparisonRow状态）
  const [historyComparingStates, setHistoryComparingStates] = useState<Map<string, Partial<ComparisonRow>>>(new Map());

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

  // 加载历史记录
  const loadHistoryRecords = async (page: number = 1) => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/policy-compare-records?page=${page}&pageSize=100`);
      const data = await response.json();

      if (data.success) {
        setHistoryRecords(data.data || []);
        setCurrentPage(data.pagination?.page || 1);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        console.error("加载历史记录失败:", data);
        showToast("加载历史记录失败", "error");
      }
    } catch (error) {
      console.error("加载历史记录时出错:", error);
      showToast("加载历史记录时出错", "error");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 页面加载时加载历史记录
  useEffect(() => {
    loadHistoryRecords(1);
  }, []);

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

  // 打开对比模式选择对话框
  const handleCompare = (row: ComparisonRow) => {
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

    // 打开对比模式选择对话框
    setCompareModeModal({ open: true, row });
  };

  // 执行对比（根据模式）
  const executeCompare = async (row: ComparisonRow, mode: "overwrite" | "create") => {
    const oldFileUrl = row.lastYearFile!.file_url || row.lastYearFile!.url;
    const newFileUrl = row.thisYearFile!.file_url || row.thisYearFile!.url;
    const oldFileName = row.lastYearFile!.name || "";
    const newFileName = row.thisYearFile!.name || "";

    // 保存是否为历史记录覆盖模式的标志
    const isHistoryOverwrite = showHistory && mode === "overwrite" && row._id;

    let targetRowId = row.id;
    let targetRow = row;

    // 如果是历史记录且选择创建新记录，需要跳转到当前对比tab并创建新条目
    if (showHistory && mode === "create") {
      // 查找当前对比中是否已有这个城市的对比行
      let existingComparison = comparisons.find(c => c.id === row.company);
      
      if (!existingComparison) {
        // 如果不存在，通过addFile来创建新的对比行
        // 先添加旧年度文件
        if (row.lastYearFile) {
          addFile({
            ...row.lastYearFile,
            id: `${row.company}_lastYear_${Date.now()}`,
            city: row.company,
            type: "lastYear",
          });
        }
        // 再添加新年度文件
        if (row.thisYearFile) {
          addFile({
            ...row.thisYearFile,
            id: `${row.company}_thisYear_${Date.now()}`,
            city: row.company,
            type: "thisYear",
          });
        }
        
        // 跳转到当前对比tab（在添加文件之后）
        setShowHistory(false);
        
        // 等待React状态更新完成（使用requestAnimationFrame等待下一个渲染周期）
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 再次等待一下让对比行创建完成
        for (let i = 0; i < 30; i++) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // 直接使用row.company作为targetRowId，因为addFile创建的对比行id就是row.company
        targetRowId = row.company;
        // 创建一个临时的targetRow，包含文件信息
        targetRow = {
          id: row.company,
          company: row.company,
          thisYearFile: row.thisYearFile,
          lastYearFile: row.lastYearFile,
          comparisonStatus: "none" as const,
        };
      } else {
        // 如果已存在，直接跳转并使用现有的对比行
        setShowHistory(false);
        targetRowId = existingComparison.id;
        targetRow = existingComparison;
        // 更新文件信息（使用历史记录中的文件信息）
        updateComparison(targetRowId, {
          thisYearFile: row.thisYearFile,
          lastYearFile: row.lastYearFile,
        });
      }
    }
    // 如果是历史记录且选择覆盖模式，直接在当前历史记录条目上显示对比状态，不跳转
    if (isHistoryOverwrite) {
      // 更新历史记录的对比状态，同时重置审核状态
      setHistoryComparingStates(prev => {
        const newMap = new Map(prev);
        newMap.set(row._id!, { 
          comparisonStatus: "comparing",
          isVerified: false, // 重新对比时重置审核状态
        });
        return newMap;
      });
      // targetRowId 保持为 row.id，这样会在历史记录中更新状态
      targetRowId = row.id;
      targetRow = row;
    } else {
      // 非历史记录覆盖模式，使用正常的updateComparison，同时重置审核状态
      updateComparison(targetRowId, { 
        comparisonStatus: "comparing",
        isVerified: false, // 重新对比时重置审核状态
      });
    }

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

      if (!response.ok || !data.success) {
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
        throw new Error(errorMessage);
      }

      // 保存结果（可能是结构化数据或原始内容）
      const resultContent = data.markdown || data.data || "对比完成";

      // 获取北京时间（UTC+8）
      const getBeijingTime = () => {
        const now = new Date();
        const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
        return beijingTime.toISOString();
      };

      // 如果是历史记录覆盖模式，更新历史记录状态
      if (isHistoryOverwrite && targetRow._id) {
        setHistoryComparingStates(prev => {
          const newMap = new Map(prev);
          newMap.set(targetRow._id!, {
            comparisonStatus: "done",
            comparisonResult: resultContent,
            comparisonStructured: data.structured || undefined,
            isJsonFormat: data.isJsonFormat || false,
            comparisonError: undefined,
            compareTime: getBeijingTime(),
            isVerified: false,
          });
          return newMap;
        });
      } else {
        updateComparison(targetRowId, {
          comparisonStatus: "done",
          comparisonResult: resultContent,
          comparisonStructured: data.structured || undefined,
          isJsonFormat: data.isJsonFormat || false,
          comparisonError: undefined,
          compareTime: getBeijingTime(), // 当前对比时间（北京时间）
          isVerified: false, // 默认未审核
        });
      }

      // 对比完成后，保存原始扣子API返回数据到数据库
      try {
        // 保存扣子API的完整原始返回数据（从API返回的rawCozeResponse字段获取）
        const rawCozeData = data.rawCozeResponse || data;
        
        if (mode === "overwrite" && targetRow._id) {
          // 覆盖模式：更新现有记录
          const updateResponse = await fetch("/api/policy-compare-records", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              _id: targetRow._id,
              company: targetRow.company,
              oldFileName: oldFileName,
              newFileName: newFileName,
              oldFileUrl: oldFileUrl,
              newFileUrl: newFileUrl,
              rawCozeResponse: rawCozeData,
              add_time: getBeijingTime(),
              isVerified: false, // 重新对比后重置审核状态
            }),
          });

          const updateData = await updateResponse.json();
          if (!updateData.success) {
            throw new Error(updateData.message || "更新记录失败");
          }
          // _id保持不变
        } else {
          // 创建模式：创建新记录
          const saveResponse = await fetch("/api/policy-compare-records", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              company: targetRow.company,
              oldFileName: oldFileName,
              newFileName: newFileName,
              oldFileUrl: oldFileUrl,
              newFileUrl: newFileUrl,
              status: "done",
              // 保存扣子API的原始返回数据（不解析，保持原始格式）
              rawCozeResponse: rawCozeData,
            }),
          });

          const saveData = await saveResponse.json();
          if (saveData.success && saveData._id) {
            // 保存数据库的_id到ComparisonRow中，用于后续更新操作
            updateComparison(targetRowId, { _id: saveData._id });
          }
        }
      } catch (saveError) {
        console.error("保存对比结果到数据库失败:", saveError);
        // 保存失败不影响UI显示
      }

      showToast("对比完成", "success");
    } catch (error: any) {
      // 如果是历史记录覆盖模式，更新历史记录错误状态
      if (isHistoryOverwrite && targetRow._id) {
        setHistoryComparingStates(prev => {
          const newMap = new Map(prev);
          newMap.set(targetRow._id!, {
            comparisonStatus: "error",
            comparisonError: error.message || "对比失败",
            comparisonResult: undefined,
          });
          return newMap;
        });
      } else {
        updateComparison(targetRowId, {
          comparisonStatus: "error",
          comparisonError: error.message || "对比失败",
          comparisonResult: undefined,
        });
      }
      showToast(error.message || "对比失败", "error");
    }
  };

  // 处理确认完成（审核）- 弹出确认对话框
  const handleVerify = (row: ComparisonRow) => {
    if (row.comparisonStatus !== "done") {
      showToast("请先完成对比", "error");
      return;
    }

    // 必须有_id才能更新，如果没有说明对比结果还没保存到数据库
    if (!row._id) {
      showToast("记录尚未保存，请等待保存完成后再确认", "error");
      return;
    }

    // 弹出确认对话框
    setVerifyModal({ open: true, row });
  };

  // 确认执行审核操作
  const confirmVerify = async () => {
    if (!verifyModal.row || !verifyModal.row._id) {
      return;
    }
    
    const row = verifyModal.row;
    setVerifyModal({ open: false, row: null });
    await verifyRecord(row._id, row.id);
  };

  // 审核记录
  const verifyRecord = async (_id: string, rowId: string) => {
    try {
      const response = await fetch("/api/policy-compare-records", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          _id: _id, // 使用数据库的_id字段
          isVerified: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 判断是否是历史记录（历史记录的rowId格式为 history_${_id}）
        if (rowId.startsWith("history_")) {
          // 历史记录：更新 historyComparingStates
          setHistoryComparingStates(prev => {
            const newMap = new Map(prev);
            const existingState = newMap.get(_id) || {};
            newMap.set(_id, {
              ...existingState,
              isVerified: true,
            });
            return newMap;
          });
        } else {
          // 当前对比：更新 comparisons
          updateComparison(rowId, { isVerified: true });
        }
        showToast("已确认完成", "success");
      } else {
        showToast(data.message || "确认失败", "error");
      }
    } catch (error) {
      console.error("确认完成失败:", error);
      showToast("确认失败，请稍后重试", "error");
    }
  };

  // 从扣子API返回的数据中提取内容（和对比API使用相同的逻辑）
  const extractContent = (data: any): any => {
    if (!data || typeof data !== 'object') {
      return null;
    }

    let extractedContent = null;
    
    if (data.data && typeof data.data === 'string') {
      try {
        const parsed = JSON.parse(data.data);
        if (parsed.data && typeof parsed.data === 'string') {
          try {
            extractedContent = JSON.parse(parsed.data);
          } catch (e) {
            extractedContent = parsed.data;
          }
        } else {
          extractedContent = parsed.data || parsed;
        }
      } catch (e) {
        extractedContent = data.data;
      }
    } else if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      if (data.data.data && typeof data.data.data === 'string') {
        try {
          extractedContent = JSON.parse(data.data.data);
        } catch (e) {
          extractedContent = data.data.data;
        }
      } else {
        extractedContent = data.data.data || data.data;
      }
    } else {
      extractedContent = data.data;
    }

    return extractedContent;
  };

  // 检查提取的内容是否是有效的JSON格式（和对比API使用相同的逻辑）
  const isValidJsonFormat = (extractedContent: any): boolean => {
    if (!extractedContent) {
      return false;
    }

    if (typeof extractedContent === 'string') {
      try {
        const parsedJson = JSON.parse(extractedContent);
        if (
          parsedJson &&
          typeof parsedJson === 'object' &&
          !Array.isArray(parsedJson) &&
          (parsedJson.summary !== undefined ||
           parsedJson.added !== undefined ||
           parsedJson.modified !== undefined ||
           parsedJson.deleted !== undefined ||
           parsedJson.statistics !== undefined ||
           parsedJson.detailed !== undefined)
        ) {
          return true;
        }
      } catch (e) {
        return false;
      }
    } else if (typeof extractedContent === 'object' && extractedContent !== null && !Array.isArray(extractedContent)) {
      if (
        extractedContent.summary !== undefined ||
        extractedContent.added !== undefined ||
        extractedContent.modified !== undefined ||
        extractedContent.deleted !== undefined ||
        extractedContent.statistics !== undefined ||
        extractedContent.detailed !== undefined
      ) {
        return true;
      }
    }

    return false;
  };

  // 将历史记录转换为ComparisonRow格式（加载时解析原始数据）
  const historyRows: ComparisonRow[] = historyRecords.map((record, index) => {
    // 解析扣子API的原始返回数据
    let structuredData = null;
    let markdownContent = null;
    let rawContent = null;
    let isJsonFormat = false;

    try {
      // 从数据库中读取原始扣子API返回数据
      if (!record.rawCozeResponse) {
        console.error("历史记录缺少原始扣子数据:", record._id);
        markdownContent = "";
      } else {
        // 解析原始扣子API返回数据
        let rawCozeData = null;
        try {
          rawCozeData = typeof record.rawCozeResponse === 'string' 
            ? JSON.parse(record.rawCozeResponse) 
            : record.rawCozeResponse;
        } catch (e) {
          console.error("解析原始扣子数据失败:", e);
          markdownContent = "";
        }

        if (rawCozeData) {
          // 使用和对比API相同的解析逻辑
          const extractedContent = extractContent(rawCozeData);

          if (isValidJsonFormat(extractedContent)) {
            let parsedJson = extractedContent;
            if (typeof extractedContent === 'string') {
              try {
                parsedJson = JSON.parse(extractedContent);
              } catch (e) {
                parsedJson = extractedContent;
              }
            }
            structuredData = parsedJson;
            isJsonFormat = true;
            markdownContent = parsedJson.detailed || null;
          } else {
            if (typeof extractedContent === 'string') {
              markdownContent = extractedContent;
              rawContent = extractedContent;
            } else if (typeof extractedContent === 'object' && extractedContent !== null) {
              rawContent = JSON.stringify(extractedContent);
              markdownContent = rawContent;
            } else {
              rawContent = extractedContent;
              markdownContent = extractedContent;
            }
          }
        }
      }
    } catch (parseError) {
      console.error("解析历史记录数据失败:", parseError);
      markdownContent = "";
    }

    // 检查是否有正在对比的状态
    const comparingState = historyComparingStates.get(record._id);

    return {
      id: `history_${record._id || index}`,
      company: record.company,
      lastYearFile: record.oldFileUrl ? {
        id: `history_old_${record._id || index}`,
        name: record.oldFileName,
        file_url: record.oldFileUrl,
        url: record.oldFileUrl,
        uploadStatus: "success" as const,
      } : null,
      thisYearFile: record.newFileUrl ? {
        id: `history_new_${record._id || index}`,
        name: record.newFileName,
        file_url: record.newFileUrl,
        url: record.newFileUrl,
        uploadStatus: "success" as const,
      } : null,
      comparisonStatus: comparingState?.comparisonStatus || ("done" as const),
      comparisonResult: comparingState?.comparisonResult !== undefined ? comparingState.comparisonResult : (markdownContent || rawContent || record.comparisonResult || ""),
      comparisonStructured: comparingState?.comparisonStructured !== undefined ? comparingState.comparisonStructured : (structuredData || undefined),
      isJsonFormat: comparingState?.isJsonFormat !== undefined ? comparingState.isJsonFormat : isJsonFormat,
      comparisonError: comparingState?.comparisonError,
      _id: record._id, // 直接使用数据库的_id字段
      compareTime: comparingState?.compareTime || record.add_time || record.createTime, // 从数据库的add_time字段获取对比时间
      isVerified: comparingState?.isVerified !== undefined ? comparingState.isVerified : (record.isVerified || false), // 是否已审核确认
    };
  });

  // 合并当前对比和历史记录
  const allComparisons = showHistory ? historyRows : comparisons;

  // 过滤对比列表
  const filteredComparisons = allComparisons.filter((row) => {
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
      case "已审核":
        return row.comparisonStatus === "done" && row.isVerified === true;
      case "未审核":
        return row.comparisonStatus === "done" && (row.isVerified === false || row.isVerified === undefined);
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
      {/* 切换按钮和分页控件 */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !showHistory
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            当前对比
          </button>
          <button
            onClick={() => {
              setShowHistory(true);
              loadHistoryRecords(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showHistory
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            历史记录
          </button>
          {showHistory && (
            <button
              onClick={() => loadHistoryRecords(currentPage)}
              disabled={isLoadingHistory}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              title="刷新历史记录"
            >
              <svg 
                className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
              {isLoadingHistory ? "刷新中..." : "刷新"}
            </button>
          )}
        </div>

        {/* 分页控件（仅历史记录显示时） */}
        {showHistory && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (currentPage > 1) {
                  loadHistoryRecords(currentPage - 1);
                }
              }}
              disabled={currentPage <= 1 || isLoadingHistory}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              上一页
            </button>
            <span className="px-4 py-2 text-sm text-slate-600">
              第 {currentPage} 页 / 共 {totalPages} 页
            </span>
            <button
              onClick={() => {
                if (currentPage < totalPages) {
                  loadHistoryRecords(currentPage + 1);
                }
              }}
              disabled={currentPage >= totalPages || isLoadingHistory}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {isLoadingHistory && showHistory && (
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 mb-2 animate-pulse">
            <svg className="h-4 w-4 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-sm text-slate-500">加载中...</p>
        </div>
      )}

      <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
        <div className="text-sm font-semibold">分公司文件对比列表（一行展示）</div>
      </div>

      {/* 桌面端：表格布局 */}
      <div className="hidden md:block overflow-auto">
        <table className="min-w-full text-left text-sm" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-white text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 font-medium" style={{ width: "160px" }}>对比时间</th>
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
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {showHistory ? "暂无历史记录" : "暂无文件，请先上传文件"}
                </td>
              </tr>
            ) : (
              sortedComparisons.map((row) => {
                // 格式化分公司名称显示，如果是未知分公司（包含未知_ID格式），只显示"未知"
                const displayCompany = row.company.startsWith("未知_") ? "未知" : row.company;
                
                // 格式化对比时间显示（北京时间）
                const formatCompareTime = (timeStr?: string) => {
                  if (!timeStr) return "—";
                  try {
                    const date = new Date(timeStr);
                    // 转换为北京时间（UTC+8）
                    const beijingTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
                    const year = beijingTime.getUTCFullYear();
                    const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
                    const day = String(beijingTime.getUTCDate()).padStart(2, '0');
                    const hours = String(beijingTime.getUTCHours()).padStart(2, '0');
                    const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0');
                    return `${year}-${month}-${day} ${hours}:${minutes}`;
                  } catch (e) {
                    return "—";
                  }
                };
                
                return (
                  <Fragment key={row.id}>
                    <tr className={`hover:bg-slate-50 ${row.isVerified ? 'bg-emerald-50/50 border-l-4 border-l-emerald-500' : ''}`}>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {formatCompareTime(row.compareTime)}
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{displayCompany}</td>

                    <td className="px-4 py-3" style={{ width: "160px" }}>
                      <FileDisplay
                        file={row.lastYearFile}
                        type="lastYear"
                        onDelete={showHistory ? undefined : () => row.lastYearFile && handleFileDelete(row.lastYearFile.id)}
                        onPreview={() => row.lastYearFile && handleFilePreview(row.lastYearFile)}
                        onUpload={showHistory ? undefined : () => handleFileUpload(row.id, "lastYear")}
                      />
                    </td>

                    <td className="px-4 py-3" style={{ width: "160px" }}>
                      <FileDisplay
                        file={row.thisYearFile}
                        type="thisYear"
                        onDelete={showHistory ? undefined : () => row.thisYearFile && handleFileDelete(row.thisYearFile.id)}
                        onPreview={() => row.thisYearFile && handleFilePreview(row.thisYearFile)}
                        onUpload={showHistory ? undefined : () => handleFileUpload(row.id, "thisYear")}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
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
                          <>
                            <span className="text-xs text-emerald-600">已完成</span>
                            {row.isVerified && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                已审核
                              </span>
                            )}
                          </>
                        )}
                        {row.comparisonStatus === "error" && (
                          <span className="text-xs text-red-600">失败</span>
                        )}
                      </div>
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
                      <div className="flex flex-col gap-2">
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
                              {/* 第一行：政策对比、佣金对比 */}
                              <div className="flex gap-2">
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
                              </div>
                              {/* 第二行：查看详情、确认完成 */}
                              <div className="flex gap-2">
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
                                {row.comparisonStatus === "done" && !row.isVerified && (
                                  <button
                                    onClick={() => handleVerify(row)}
                                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 flex items-center gap-1"
                                  >
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    确认完成
                                  </button>
                                )}
                                {row.comparisonStatus === "done" && row.isVerified && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs text-emerald-700">
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    已确认
                                  </span>
                                )}
                              </div>
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
              <div key={row.id} className={`p-4 space-y-3 ${row.isVerified ? 'bg-emerald-50/50 border-l-4 border-l-emerald-500' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{displayCompany}</div>
                </div>
                
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
                  <div className="flex flex-col items-center gap-1">
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
                      <>
                        <span className="text-xs text-emerald-600">已完成</span>
                        {row.isVerified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            已审核
                          </span>
                        )}
                      </>
                    )}
                    {row.comparisonStatus === "error" && (
                      <span className="text-xs text-red-600">失败</span>
                    )}
                  </div>
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
                  <div className="flex flex-col gap-2">
                    {canCompare ? (
                      <>
                        {/* 第一行：政策对比、佣金对比 */}
                        <div className="flex gap-2">
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
                        </div>
                        {/* 第二行：查看详情、确认完成 */}
                        <div className="flex gap-2">
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
                          {row.comparisonStatus === "done" && !row.isVerified && (
                            <button
                              onClick={() => handleVerify(row)}
                              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 flex items-center gap-1"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                              确认完成
                            </button>
                          )}
                          {row.comparisonStatus === "done" && row.isVerified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs text-emerald-700">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                              已确认
                            </span>
                          )}
                        </div>
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

    {/* 对比模式选择对话框 */}
    {compareModeModal.open && compareModeModal.row && createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 relative">
          {/* 关闭按钮 */}
          <button
            onClick={() => setCompareModeModal({ open: false, row: null })}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* 对话框内容 */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">请选择对比模式</h3>
            <p className="text-sm text-slate-600 mb-6">
              分公司：{compareModeModal.row.company}
            </p>

            <div className="space-y-3">
              {/* 覆盖当前记录 */}
              <button
                onClick={async () => {
                  setCompareModeModal({ open: false, row: null });
                  await executeCompare(compareModeModal.row!, "overwrite");
                }}
                className="w-full px-6 py-5 rounded-2xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center justify-center text-center relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="font-bold text-lg mb-1.5">覆盖当前记录</div>
                  <div className="text-sm text-blue-50 leading-relaxed">
                    更新当前记录
                  </div>
                </div>
              </button>

              {/* 创建新的记录 */}
              <button
                onClick={async () => {
                  setCompareModeModal({ open: false, row: null });
                  await executeCompare(compareModeModal.row!, "create");
                }}
                className="w-full px-6 py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center justify-center text-center relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="font-bold text-lg mb-1.5">创建新的记录</div>
                  <div className="text-sm text-emerald-50 leading-relaxed">
                    {showHistory 
                      ? "跳转并创建新条目"
                      : "创建新的对比记录"}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* 确认完成对话框 */}
    {verifyModal.open && verifyModal.row && createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 relative">
          {/* 关闭按钮 */}
          <button
            onClick={() => setVerifyModal({ open: false, row: null })}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* 对话框内容 */}
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">确认完成审核</h3>
                <p className="text-sm text-slate-600 mt-1">
                  分公司：{verifyModal.row.company}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6">
              确认要将此对比记录标记为已审核完成吗？此操作将更新数据库中的审核状态。
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setVerifyModal({ open: false, row: null })}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmVerify}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                确认完成
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
    </Fragment>
  );
}
