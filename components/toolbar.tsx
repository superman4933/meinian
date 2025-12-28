"use client";

import { useState } from "react";
import { useFileContext } from "@/contexts/file-context";
import { getCozeTokenClient } from "@/lib/coze-config";

export function Toolbar() {
  const { comparisons, updateComparison } = useFileContext();
  const [isComparing, setIsComparing] = useState(false);

  const handleBatchCompare = async (type: "policy" | "commission") => {
    // 筛选出可以对比的项（今年和去年文件都齐全）
    const readyComparisons = comparisons.filter(
      (c) =>
        c.thisYearFile &&
        c.lastYearFile &&
        c.thisYearFile.file_id &&
        c.lastYearFile.file_id &&
        c.comparisonStatus !== "comparing"
    );

    if (readyComparisons.length === 0) {
      alert("没有可对比的文件，请先上传今年和去年的文件");
      return;
    }

    // 弹出确认对话框
    const confirmMessage = `是否对比 ${readyComparisons.length} 个文件？`;
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsComparing(true);

    try {
      // 并发对比所有文件
      const comparePromises = readyComparisons.map(async (row) => {
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
              file1_id: row.lastYearFile!.file_id,
              file2_id: row.thisYearFile!.file_id,
              prompt: type === "policy" 
                ? "请分析这两个政策文件的差异" 
                : "请分析这两个佣金文件的差异",
            }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || "对比失败");
          }

          updateComparison(row.id, {
            comparisonStatus: "done",
            comparisonResult: data.data || "对比完成",
            comparisonError: undefined,
          });
        } catch (error: any) {
          updateComparison(row.id, {
            comparisonStatus: "error",
            comparisonError: error.message || "对比失败",
            comparisonResult: undefined,
          });
        }
      });

      await Promise.all(comparePromises);
      alert(`已完成 ${readyComparisons.length} 个文件的对比`);
    } catch (error) {
      console.error("批量对比错误:", error);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <option>全部状态</option>
            <option>可比对</option>
            <option>缺文件</option>
            <option>已完成</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleBatchCompare("policy")}
            disabled={isComparing || comparisons.filter(
              (c) =>
                c.thisYearFile &&
                c.lastYearFile &&
                c.thisYearFile.file_id &&
                c.lastYearFile.file_id
            ).length === 0}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isComparing ? "对比中..." : "政策一键对比"}
          </button>
          <button
            onClick={() => handleBatchCompare("commission")}
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
