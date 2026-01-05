"use client";

import { useState } from "react";
import { useFileContext } from "@/contexts/file-context";
import { getCozeTokenClient } from "@/lib/coze-config";

interface ToolbarProps {
  onFilterChange?: (filter: string) => void;
}

export function Toolbar({ onFilterChange }: ToolbarProps) {
  const { comparisons, updateComparison } = useFileContext();
  const [isComparing, setIsComparing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("全部状态");
  const [compareProgress, setCompareProgress] = useState({ current: 0, total: 0 });

  const handleFilterChange = (value: string) => {
    setFilterStatus(value);
    if (onFilterChange) {
      onFilterChange(value);
    }
  };

  const handleBatchCompare = async (type: "policy" | "commission") => {
    // 筛选出可以对比的项（新年度和旧年度文件都齐全）
    const readyComparisons = comparisons.filter(
      (c) =>
        c.thisYearFile &&
        c.lastYearFile &&
        (c.thisYearFile.file_url || c.thisYearFile.url) &&
        (c.lastYearFile.file_url || c.lastYearFile.url) &&
        c.comparisonStatus !== "comparing"
    );

    if (readyComparisons.length === 0) {
      // 使用 toast 提示
      const toast = document.createElement("div");
      toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-red-500 text-white px-6 py-4 rounded-lg shadow-xl text-sm";
      toast.textContent = "没有可对比的文件，请先上传新年度和旧年度的文件";
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = "1"; }, 10);
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 2700);
      return;
    }

    // 弹出确认对话框
    const confirmMessage = `是否对比 ${readyComparisons.length} 个文件？`;
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsComparing(true);
    setCompareProgress({ current: 0, total: readyComparisons.length });

    try {
      // 并发对比所有文件，但跟踪进度
      let completedCount = 0;
      const comparePromises = readyComparisons.map(async (row) => {
        updateComparison(row.id, { comparisonStatus: "comparing" });

        const oldFileUrl = row.lastYearFile!.file_url || row.lastYearFile!.url;
        const newFileUrl = row.thisYearFile!.file_url || row.thisYearFile!.url;
        const oldFileName = row.lastYearFile!.name || "";
        const newFileName = row.thisYearFile!.name || "";

        if (!oldFileName || !newFileName) {
          updateComparison(row.id, {
            comparisonStatus: "error",
            comparisonError: "文件名称信息缺失",
          });
          completedCount++;
          setCompareProgress({ current: completedCount, total: readyComparisons.length });
          return;
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
            throw new Error(data.message || "对比失败");
          }

          // 保存结果
          const resultContent = data.markdown || data.data || "对比完成";

          // 获取北京时间（UTC+8）
          const getBeijingTime = () => {
            const now = new Date();
            const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
            return beijingTime.toISOString();
          };

          updateComparison(row.id, {
            comparisonStatus: "done",
            comparisonResult: resultContent,
            comparisonStructured: data.structured || undefined,
            isJsonFormat: data.isJsonFormat || false,
            comparisonError: undefined,
            compareTime: getBeijingTime(), // 当前对比时间（北京时间）
          });

          // 对比完成后，保存原始扣子API返回数据到数据库
          try {
            // 保存扣子API的完整原始返回数据（从API返回的rawCozeResponse字段获取）
            const rawCozeData = data.rawCozeResponse || data;
            
            const saveResponse = await fetch("/api/policy-compare-records", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                company: row.company,
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
              updateComparison(row.id, { _id: saveData._id });
            }
          } catch (saveError) {
            console.error(`保存对比结果到数据库失败 [${row.company}]:`, saveError);
          }
        } catch (error: any) {
          updateComparison(row.id, {
            comparisonStatus: "error",
            comparisonError: error.message || "对比失败",
            comparisonResult: undefined,
          });
        }
        
        // 更新进度
        completedCount++;
        setCompareProgress({ current: completedCount, total: readyComparisons.length });
      });

      await Promise.all(comparePromises);
      // 使用 toast 提示
      const toast = document.createElement("div");
      toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-emerald-500 text-white px-6 py-4 rounded-lg shadow-xl text-sm";
      toast.textContent = `已完成 ${readyComparisons.length} 个文件的对比`;
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = "1"; }, 10);
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 2700);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("批量对比错误:", error);
      }
      // 使用 toast 提示错误
      const toast = document.createElement("div");
      toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-red-500 text-white px-6 py-4 rounded-lg shadow-xl text-sm";
      toast.textContent = "批量对比过程中出现错误，请检查网络连接";
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = "1"; }, 10);
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 2700);
    } finally {
      setIsComparing(false);
      setCompareProgress({ current: 0, total: 0 }); // 重置进度
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select 
            value={filterStatus}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="全部状态">全部状态</option>
            <option value="可比对">可比对</option>
            <option value="缺文件">缺文件</option>
            <option value="已完成">已完成</option>
            <option value="已审核">已审核</option>
            <option value="未审核">未审核</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleBatchCompare("policy")}
            disabled={isComparing || comparisons.filter(
              (c) =>
                c.thisYearFile &&
                c.lastYearFile &&
                (c.thisYearFile.file_url || c.thisYearFile.url) &&
                (c.lastYearFile.file_url || c.lastYearFile.url)
            ).length === 0}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isComparing ? `对比中 ${compareProgress.current}/${compareProgress.total}` : "政策一键对比"}
          </button>
          <button
            onClick={() => {
              // 显示toast提示
              if (typeof window === "undefined") return;
              const toast = document.createElement("div");
              toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-slate-900 text-white px-6 py-4 rounded-lg shadow-xl text-sm";
              toast.textContent = "该功能正在开发中";
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
            }}
            disabled={isComparing}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isComparing ? "对比中..." : "佣金一键对比"}
          </button>
        </div>
      </div>
    </div>
  );
}
