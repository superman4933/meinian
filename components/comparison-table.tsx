"use client";

import { useState, Fragment } from "react";

interface ComparisonRow {
  id: string;
  company: string;
  thisYearFile: {
    name: string;
    size: string;
  };
  lastYearFile: {
    name: string;
    size: string;
  } | null;
  status: "ready" | "missing" | "done";
  stats: {
    added?: number;
    deleted?: number;
    modified?: number;
    highRisk?: number;
  };
}

const mockData: ComparisonRow[] = [
  {
    id: "shanghai",
    company: "上海分公司",
    thisYearFile: { name: "上海_今年.pdf", size: "2.3MB" },
    lastYearFile: { name: "上海_去年.docx", size: "640KB" },
    status: "ready",
    stats: { added: 18, deleted: 6, modified: 12, highRisk: 2 },
  },
  {
    id: "shenzhen",
    company: "深圳分公司",
    thisYearFile: { name: "深圳_今年.pdf", size: "1.1MB" },
    lastYearFile: null,
    status: "missing",
    stats: {},
  },
  {
    id: "guangzhou",
    company: "广州分公司",
    thisYearFile: { name: "广州_今年.docx", size: "520KB" },
    lastYearFile: { name: "广州_去年.pdf", size: "1.9MB" },
    status: "done",
    stats: { added: 3, deleted: 1, modified: 2, highRisk: 0 },
  },
];

function PreviewRow({ row, isOpen, onToggle }: { row: ComparisonRow; isOpen: boolean; onToggle: () => void }) {
  if (!isOpen) return null;

  if (row.status === "ready") {
    return (
      <tr className="bg-slate-50/50">
        <td colSpan={5} className="px-4 py-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">文件信息预览</h3>
              <button onClick={onToggle} className="text-xs text-slate-500 hover:text-slate-700">
                收起
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-medium text-slate-600">今年文件</div>
                <div className="text-xs text-slate-700">文件名：{row.thisYearFile.name}</div>
                <div className="text-xs text-slate-500">大小：{row.thisYearFile.size} | 上传时间：2024-12-25 10:15</div>
              </div>
              {row.lastYearFile && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-medium text-slate-600">去年文件</div>
                  <div className="text-xs text-slate-700">文件名：{row.lastYearFile.name}</div>
                  <div className="text-xs text-slate-500">大小：{row.lastYearFile.size} | 上传时间：2023-12-20 09:30</div>
                </div>
              )}
            </div>
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="text-xs font-medium text-amber-800">提示：文件已就绪，可进行对比</div>
              <div className="mt-1 text-xs text-amber-700">
                预计对比结果：新增 {row.stats.added ?? 0} 条 | 删除 {row.stats.deleted ?? 0} 条 | 修改 {row.stats.modified ?? 0} 条 | 高风险 {row.stats.highRisk ?? 0} 条
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  if (row.status === "done") {
    return (
      <tr className="bg-slate-50/50">
        <td colSpan={5} className="px-4 py-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">对比详情预览</h3>
              <button onClick={onToggle} className="text-xs text-slate-500 hover:text-slate-700">
                收起
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-medium text-slate-600">新增内容</div>
                <div className="space-y-1 text-xs">
                  <div className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">• 新增条款：员工福利政策（第3条）</div>
                  <div className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">• 新增条款：绩效考核标准（第8条）</div>
                  <div className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">• 新增条款：培训管理制度（第12条）</div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-medium text-slate-600">删除内容</div>
                <div className="space-y-1 text-xs">
                  <div className="rounded bg-rose-50 px-2 py-1 text-rose-700">• 删除条款：旧版考勤制度（原第5条）</div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-medium text-slate-600">修改内容</div>
                <div className="space-y-1 text-xs">
                  <div className="rounded bg-amber-50 px-2 py-1 text-amber-700">• 修改：请假流程（第6条）</div>
                  <div className="rounded bg-amber-50 px-2 py-1 text-amber-700">• 修改：薪资结构说明（第9条）</div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span className="text-xs text-slate-600">对比时间：2024-12-25 14:30</span>
              <button className="rounded-lg bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-800">查看完整报告</button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return null;
}

export function ComparisonTable() {
  const [openPreviews, setOpenPreviews] = useState<Set<string>>(new Set());

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

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
        <div className="text-sm font-semibold">分公司文件对比列表（一行展示）</div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 font-medium">分公司</th>
              <th className="px-4 py-3 font-medium">今年文件</th>
              <th className="px-4 py-3 font-medium">去年文件</th>
              <th className="px-4 py-3 font-medium">对比结果（同一行）</th>
              <th className="px-4 py-3 font-medium text-right">操作</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 bg-white">
            {mockData.map((row) => (
              <Fragment key={row.id}>
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{row.company}</td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100">📄</span>
                      <div>
                        <div className="font-medium">{row.thisYearFile.name}</div>
                        <div className="text-xs text-slate-500">{row.thisYearFile.size}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {row.lastYearFile ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100">📄</span>
                        <div>
                          <div className="font-medium">{row.lastYearFile.name}</div>
                          <div className="text-xs text-slate-500">{row.lastYearFile.size}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100">—</span>
                        <div>
                          <div className="font-medium">未上传</div>
                          <div className="text-xs">请补齐去年文件</div>
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.status === "ready" && (
                        <>
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">可比对</span>
                          {row.stats.added !== undefined && row.stats.added > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">新增 {row.stats.added}</span>
                          )}
                          {row.stats.deleted !== undefined && row.stats.deleted > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">删除 {row.stats.deleted}</span>
                          )}
                          {row.stats.modified !== undefined && row.stats.modified > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">修改 {row.stats.modified}</span>
                          )}
                          {row.stats.highRisk !== undefined && (
                            <span className={`rounded-full px-2 py-1 text-xs ${row.stats.highRisk > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                              高风险 {row.stats.highRisk}
                            </span>
                          )}
                        </>
                      )}
                      {row.status === "missing" && (
                        <>
                          <span className="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-700">缺文件</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">结果：—</span>
                        </>
                      )}
                      {row.status === "done" && (
                        <>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">已完成</span>
                          {row.stats.added !== undefined && row.stats.added > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">新增 {row.stats.added}</span>
                          )}
                          {row.stats.deleted !== undefined && row.stats.deleted > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">删除 {row.stats.deleted}</span>
                          )}
                          {row.stats.modified !== undefined && row.stats.modified > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">修改 {row.stats.modified}</span>
                          )}
                          {row.stats.highRisk !== undefined && (
                            <span className={`rounded-full px-2 py-1 text-xs ${row.stats.highRisk > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                              高风险 {row.stats.highRisk}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex gap-2">
                      {row.status === "ready" && (
                        <>
                          <button className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800">单独对比（政策）</button>
                          <button className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50">单独对比（佣金）</button>
                          <button onClick={() => togglePreview(row.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50">
                            查看详情
                          </button>
                        </>
                      )}
                      {row.status === "missing" && (
                        <>
                          <button className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-400 cursor-not-allowed">
                            单独对比（政策）
                          </button>
                          <button className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-400 cursor-not-allowed">
                            单独对比（佣金）
                          </button>
                        </>
                      )}
                      {row.status === "done" && (
                        <>
                          <button className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800">重新对比（政策）</button>
                          <button className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50">重新对比（佣金）</button>
                          <button onClick={() => togglePreview(row.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50">
                            查看详情
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                <PreviewRow key={`preview-${row.id}`} row={row} isOpen={openPreviews.has(row.id)} onToggle={() => togglePreview(row.id)} />
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 flex items-center justify-between">
        <span>提示：只有"今年+去年"齐全才可"单独比对 / 一键比对"。</span>
        <span>共 300 家（示意：分页/滚动）</span>
      </div>
    </section>
  );
}

