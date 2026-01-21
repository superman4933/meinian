"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useFileContext } from "@/contexts/file-context";
import { getCozeTokenClient } from "@/lib/coze-config";
import { getCurrentUsername } from "@/lib/user";

interface ToolbarProps {
  onFilterChange?: (filter: string) => void;
}

export function Toolbar({ onFilterChange }: ToolbarProps) {
  const { comparisons, updateComparison } = useFileContext();
  const [isComparing, setIsComparing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("全部状态");
  const [compareProgress, setCompareProgress] = useState({ current: 0, total: 0, waiting: 0, comparing: 0 });
  const isCancelledRef = useRef(false);
  const comparisonsRef = useRef(comparisons);
  const completedCountRef = useRef(0); // 使用 ref 跟踪完成数量
  
  // 保持 comparisonsRef 与 comparisons 同步
  useEffect(() => {
    comparisonsRef.current = comparisons;
  }, [comparisons]);

  const handleFilterChange = (value: string) => {
    setFilterStatus(value);
    if (onFilterChange) {
      onFilterChange(value);
    }
  };

  // 并发控制函数：限制同时执行的任务数
  const limitConcurrency = async (
    tasks: (() => Promise<void>)[],
    limit: number = 5
  ): Promise<void> => {
    const executing: Promise<void>[] = [];

    for (const task of tasks) {
      // 检查是否已取消
      if (isCancelledRef.current) {
        break;
      }

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
        try {
          await Promise.race(executing);
        } catch (error) {
          // 处理错误，但不中断循环
          // 错误会在任务内部处理，这里只记录日志
          if (process.env.NODE_ENV === 'development') {
            console.error("任务执行错误:", error);
          }
        }
      }
    }

    // 等待所有剩余任务完成
    await Promise.allSettled(executing);
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    // 将所有等待中的任务恢复为 none（使用最新的状态）
    comparisonsRef.current.forEach((row) => {
      if (row.comparisonStatus === "waiting") {
        updateComparison(row.id, { comparisonStatus: "none" });
      }
    });
    setIsComparing(false);
    setCompareProgress({ current: 0, total: 0, waiting: 0, comparing: 0 });
  };

  const handleBatchCompare = async (type: "policy" | "commission") => {
    // 筛选出可以对比的项（新年度和旧年度文件都齐全，且不是正在对比中）
    const readyComparisons = comparisons.filter(
      (c) =>
        c.thisYearFile &&
        c.lastYearFile &&
        (c.thisYearFile.file_url || c.thisYearFile.url) &&
        (c.lastYearFile.file_url || c.lastYearFile.url) &&
        c.comparisonStatus !== "comparing" &&
        c.comparisonStatus !== "waiting"
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

    isCancelledRef.current = false;
    setIsComparing(true);
    
    // 创建一个 Set 来跟踪应该处理的任务 ID
    const taskIds = new Set(readyComparisons.map(row => row.id));
    
    // 先设置所有任务为"等待中"
    readyComparisons.forEach((row) => {
      updateComparison(row.id, { comparisonStatus: "waiting" });
    });

    const totalCount = readyComparisons.length;

    // 初始化进度
    completedCountRef.current = 0;
    setCompareProgress({
      current: 0,
      total: totalCount,
      waiting: totalCount,
      comparing: 0,
    });

    // 等待一个 tick，确保状态更新完成
    await new Promise(resolve => setTimeout(resolve, 0));

    // 使用函数式更新来避免竞态条件
    const updateProgress = (
      incrementCurrent: number = 0, 
      decrementWaiting: number = 0, 
      incrementComparing: number = 0,
      decrementComparing: number = 0
    ) => {
      if (incrementCurrent > 0) {
        completedCountRef.current += incrementCurrent;
      }
      setCompareProgress((prev) => ({
        current: completedCountRef.current,
        total: totalCount,
        waiting: Math.max(0, prev.waiting - decrementWaiting),
        comparing: Math.max(0, prev.comparing + incrementComparing - decrementComparing),
      }));
    };

    try {
      // 创建任务数组
      const compareTasks = readyComparisons.map((row) => async () => {
        // 检查是否已取消
        if (isCancelledRef.current) {
          return;
        }

        // 检查任务是否还在待处理列表中
        if (!taskIds.has(row.id)) {
          return;
        }

        // 检查当前状态，使用最新的 comparisonsRef 避免闭包问题
        const currentRow = comparisonsRef.current.find((c) => c.id === row.id);
        if (!currentRow) {
          // 如果找不到，说明可能被删除了，从任务列表中移除
          taskIds.delete(row.id);
          return;
        }
        
        // 如果状态是 comparing 或 done，说明已经在处理中或已完成，跳过
        if (currentRow.comparisonStatus === "comparing" || currentRow.comparisonStatus === "done") {
          taskIds.delete(row.id);
          return;
        }
        
        // 如果状态是 error，也跳过（避免重复处理失败的任务）
        if (currentRow.comparisonStatus === "error") {
          taskIds.delete(row.id);
          return;
        }
        
        // 如果状态是 none 或 waiting，都可以执行（none 可能是状态更新延迟导致的）
        // 从任务列表中移除，避免重复处理
        taskIds.delete(row.id);
        
        // 从当前状态变为对比中
        updateComparison(row.id, { comparisonStatus: "comparing" });

        // 从等待中变为对比中
        updateComparison(row.id, { comparisonStatus: "comparing" });
        updateProgress(0, 1, 1, 0); // 减少等待中数量，增加进行中数量

        const oldFileUrl = row.lastYearFile!.file_url || row.lastYearFile!.url;
        const newFileUrl = row.thisYearFile!.file_url || row.thisYearFile!.url;
        const oldFileName = row.lastYearFile!.name || "";
        const newFileName = row.thisYearFile!.name || "";

        if (!oldFileName || !newFileName) {
          updateComparison(row.id, {
            comparisonStatus: "error",
            comparisonError: "文件名称信息缺失",
          });
          updateProgress(1, 0, 0, 1); // 增加完成数量，减少进行中数量
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
            
            // 获取用户名
            const username = getCurrentUsername();
            if (!username) {
              console.error("保存对比结果失败：未登录");
              return;
            }
            
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
                username: username, // 添加用户名参数
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
        } finally {
          // 无论成功还是失败，都要更新进度
          updateProgress(1, 0, 0, 1); // 增加完成数量，减少进行中数量
        }
      });

      // 使用并发控制执行任务
      await limitConcurrency(compareTasks, 5);

      // 如果被取消，恢复所有等待中的任务（使用最新的状态）
      if (isCancelledRef.current) {
        comparisonsRef.current.forEach((row) => {
          if (row.comparisonStatus === "waiting") {
            updateComparison(row.id, { comparisonStatus: "none" });
          }
        });
      }

      // 使用 toast 提示
      if (!isCancelledRef.current) {
        const finalCompletedCount = completedCountRef.current;
        const toast = document.createElement("div");
        toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-emerald-500 text-white px-6 py-4 rounded-lg shadow-xl text-sm";
        toast.textContent = `已完成 ${finalCompletedCount} 个文件的对比`;
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.3s";
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = "1"; }, 10);
        setTimeout(() => {
          toast.style.opacity = "0";
          setTimeout(() => toast.remove(), 300);
        }, 2700);
      }
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
      isCancelledRef.current = false;
      setCompareProgress({ current: 0, total: 0, waiting: 0, comparing: 0 }); // 重置进度
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-col gap-1">
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
            <div className="text-xs text-slate-400 px-1">
              切换筛选条件将清空已选中的项
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isComparing ? (
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 transition-colors whitespace-nowrap"
                >
                  取消{compareProgress.waiting > 0 && ` (等待中: ${compareProgress.waiting})`}
                </button>
                <div className="flex-1 flex flex-col gap-1">
                  <div className="text-sm text-slate-700 font-medium">
                    已完成: {compareProgress.current} | 进行中: {compareProgress.comparing} | 等待中: {compareProgress.waiting} | 总计: {compareProgress.total}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${compareProgress.total > 0 ? Math.round((compareProgress.current / compareProgress.total) * 100) : 0}%` 
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-600 font-medium min-w-[3rem] text-right">
                      {compareProgress.total > 0 ? Math.round((compareProgress.current / compareProgress.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
              <span className="text-xs text-slate-500 px-1">
                只能取消等待中的任务，已经开始的任务无法取消
              </span>
            </div>
          ) : (
            <>
              <button
                onClick={() => handleBatchCompare("policy")}
                disabled={comparisons.filter(
                  (c) =>
                    c.thisYearFile &&
                    c.lastYearFile &&
                    (c.thisYearFile.file_url || c.thisYearFile.url) &&
                    (c.lastYearFile.file_url || c.lastYearFile.url) &&
                    c.comparisonStatus !== "comparing" &&
                    c.comparisonStatus !== "waiting"
                ).length === 0}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                政策一键对比
              </button>
            </>
          )}
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
