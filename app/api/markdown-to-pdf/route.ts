import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  let tempMarkdownFile: string | null = null;
  let tempPdfFile: string | null = null;

  try {
    const body = await request.json();
    const { markdown } = body;

    if (!markdown || typeof markdown !== "string") {
      return NextResponse.json(
        { success: false, message: "缺少 markdown 内容" },
        { status: 400 }
      );
    }

    // 创建临时文件
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    tempMarkdownFile = path.join(tempDir, `markdown_${timestamp}.md`);
    tempPdfFile = path.join(tempDir, `output_${timestamp}.pdf`);

    // 写入 Markdown 内容到临时文件
    fs.writeFileSync(tempMarkdownFile, markdown, "utf-8");

    // 检查 Pandoc 是否可用
    try {
      await execAsync("pandoc --version");
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: "服务器未安装 Pandoc，请联系管理员安装 Pandoc",
        },
        { status: 500 }
      );
    }

    // 使用 Pandoc 转换为 PDF
    // 使用 xelatex 引擎以支持中文
    const pandocCommand = `pandoc "${tempMarkdownFile}" -o "${tempPdfFile}" --pdf-engine=xelatex -V CJKmainfont="SimSun" -V geometry:margin=1in --highlight-style=github`;

    console.log("🔵 [Markdown转PDF] 执行 Pandoc 命令:", pandocCommand);

    try {
      const { stdout, stderr } = await execAsync(pandocCommand, {
        timeout: 30000, // 30秒超时
      });

      if (stderr && !stderr.includes("Warning")) {
        console.warn("⚠️ [Markdown转PDF] Pandoc 警告:", stderr);
      }

      // 检查 PDF 文件是否生成
      if (!fs.existsSync(tempPdfFile)) {
        throw new Error("PDF 文件未生成");
      }

      // 读取 PDF 文件
      const pdfBuffer = fs.readFileSync(tempPdfFile);

      // 清理临时文件
      try {
        if (tempMarkdownFile) fs.unlinkSync(tempMarkdownFile);
        if (tempPdfFile) fs.unlinkSync(tempPdfFile);
      } catch (cleanupError) {
        console.error("清理临时文件失败:", cleanupError);
      }

      // 返回 PDF 文件
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="对比报告_${new Date().toISOString().split("T")[0]}.pdf"`,
        },
      });
    } catch (pandocError: any) {
      console.error("❌ [Markdown转PDF] Pandoc 执行失败:", pandocError);
      
      // 尝试使用默认引擎（如果 xelatex 不可用）
      if (pandocError.message?.includes("xelatex")) {
        console.log("🔵 [Markdown转PDF] 尝试使用默认 PDF 引擎");
        try {
          const fallbackCommand = `pandoc "${tempMarkdownFile}" -o "${tempPdfFile}" --highlight-style=github`;
          const { stdout, stderr } = await execAsync(fallbackCommand, {
            timeout: 30000,
          });

          if (fs.existsSync(tempPdfFile)) {
            const pdfBuffer = fs.readFileSync(tempPdfFile);
            
            // 清理临时文件
            try {
              if (tempMarkdownFile) fs.unlinkSync(tempMarkdownFile);
              if (tempPdfFile) fs.unlinkSync(tempPdfFile);
            } catch (cleanupError) {
              console.error("清理临时文件失败:", cleanupError);
            }

            return new NextResponse(pdfBuffer, {
              headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="对比报告_${new Date().toISOString().split("T")[0]}.pdf"`,
              },
            });
          }
        } catch (fallbackError) {
          console.error("❌ [Markdown转PDF] 备用引擎也失败:", fallbackError);
        }
      }

      return NextResponse.json(
        {
          success: false,
          message: `PDF 转换失败: ${pandocError.message || "未知错误"}`,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("❌ [Markdown转PDF] 处理请求失败:", error);

    // 清理临时文件
    try {
      if (tempMarkdownFile && fs.existsSync(tempMarkdownFile)) {
        fs.unlinkSync(tempMarkdownFile);
      }
      if (tempPdfFile && fs.existsSync(tempPdfFile)) {
        fs.unlinkSync(tempPdfFile);
      }
    } catch (cleanupError) {
      console.error("清理临时文件失败:", cleanupError);
    }

    return NextResponse.json(
      {
        success: false,
        message: error.message || "处理请求失败",
      },
      { status: 500 }
    );
  }
}

