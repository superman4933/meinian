import { NextRequest, NextResponse } from "next/server";
import { getCozeToken } from "@/lib/coze-config";

const WORKFLOW_ID = "7588132283023786047";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file1_id, file2_id, prompt } = body;

    if (!file1_id || !file2_id) {
      return NextResponse.json(
        { success: false, message: "缺少文件ID" },
        { status: 400 }
      );
    }

    // 获取扣子API Token（优先从请求头读取，如果没有则使用默认值）
    const tokenFromHeader = request.headers.get("x-coze-token");
    const cozeToken = tokenFromHeader || getCozeToken(request);

    // 调用扣子工作流API
    const response = await fetch("https://api.coze.cn/v1/workflow/run", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cozeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: WORKFLOW_ID,
        parameters: {
          file1: JSON.stringify({ file_id: file1_id }),
          file2: JSON.stringify({ file_id: file2_id }),
          prompt: prompt || "请分析这两个文件的内容差异",
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data.message || "对比失败",
          error_code: data.code,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: data.data || data,
      execute_id: data.execute_id,
      debug_url: data.debug_url,
    });
  } catch (error: any) {
    console.error("Compare error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "对比失败，请稍后重试",
      },
      { status: 500 }
    );
  }
}

