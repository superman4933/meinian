"use client";

interface FileUploadProps {
  type: "lastYear" | "thisYear";
}

export function FileUpload({ type }: FileUploadProps) {
  const isLastYear = type === "lastYear";
  const title = isLastYear ? "上传去年文件" : "上传今年文件";

  if (isLastYear) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-6 hover:border-amber-400 hover:bg-amber-50 transition-colors">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-2 text-amber-700">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-sm font-semibold">{title}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <label className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 hover:border-amber-400 cursor-pointer transition-colors">
              <input type="file" multiple accept=".pdf,.doc,.docx" className="hidden" />
              <span>选择文件</span>
            </label>
            <span className="text-xs text-amber-600">或拖拽文件到此处</span>
          </div>
          <div className="text-xs text-amber-500">支持 PDF、DOC、DOCX 格式</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-6 hover:border-blue-400 hover:bg-blue-50 transition-colors">
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-2 text-blue-700">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <label className="rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 hover:border-blue-400 cursor-pointer transition-colors">
            <input type="file" multiple accept=".pdf,.doc,.docx" className="hidden" />
            <span>选择文件</span>
          </label>
          <span className="text-xs text-blue-600">或拖拽文件到此处</span>
        </div>
        <div className="text-xs text-blue-500">支持 PDF、DOC、DOCX 格式</div>
      </div>
    </div>
  );
}

