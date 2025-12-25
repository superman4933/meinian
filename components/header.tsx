export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold">
            PF
          </div>
          <div>
            <div className="text-sm font-semibold leading-4">政策文件对比（极简）</div>
            <div className="text-xs text-slate-500">今年文件 + 去年文件 + 结果，一行展示</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 cursor-pointer">
            <input type="file" multiple accept=".pdf,.doc,.docx" className="hidden" />
            <span>上传文件</span>
          </label>
        </div>
      </div>
    </header>
  );
}

