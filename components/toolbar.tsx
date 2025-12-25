export function Toolbar() {
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
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
            政策一键对比
          </button>
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
            佣金一键对比
          </button>
        </div>
      </div>
    </div>
  );
}

