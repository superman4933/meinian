import { Header } from "@/components/header";
import { FileUpload } from "@/components/file-upload";
import { Toolbar } from "@/components/toolbar";
import { ComparisonTable } from "@/components/comparison-table";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        {/* File Upload Areas */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FileUpload type="lastYear" />
          <FileUpload type="thisYear" />
        </div>

        <Toolbar />

        <ComparisonTable />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-slate-500">
        极简一行版：今年文件｜去年文件｜对比结果（同一行）｜操作（单独比对/查看）
      </footer>
    </>
  );
}

