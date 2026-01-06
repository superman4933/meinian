import { NextRequest, NextResponse } from "next/server";

const GUGUDATA_API_URL = "https://api.gugudata.com/imagerecognition/markdown2pdf";
const APPKEY = "2YDVVZVUTAPE73L7F7LP3ASCK9GJQ46K";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { markdown } = body;

    if (!markdown || typeof markdown !== "string") {
      return NextResponse.json(
        { success: false, message: "缺少 markdown 内容" },
        { status: 400 }
      );
    }

    console.log("🔵 [Markdown转PDF] 调用咕咕数据 API，内容长度:", markdown.length);

    // 构建请求参数（application/x-www-form-urlencoded 格式）
    const params = new URLSearchParams();
    params.append("appkey", APPKEY);
    params.append("content", markdown);

    // 调用咕咕数据 API
    const response = await fetch(GUGUDATA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      console.error("❌ [Markdown转PDF] 咕咕数据 API 请求失败:", response.status, response.statusText);
      return NextResponse.json(
        {
          success: false,
          message: `API 请求失败: ${response.status} ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("🔵 [Markdown转PDF] 咕咕数据 API 响应:", {
      statusCode: data.DataStatus?.StatusCode,
      statusDescription: data.DataStatus?.StatusDescription,
      hasData: !!data.Data,
    });

    // 检查业务状态码
    if (data.DataStatus?.StatusCode !== 100) {
      const errorMsg = data.DataStatus?.StatusDescription || "PDF 转换失败";
      console.error("❌ [Markdown转PDF] 业务错误:", errorMsg);
      
      // 根据错误码返回不同的错误信息
      let userMessage = errorMsg;
      if (data.DataStatus?.StatusCode === 503) {
        userMessage = "APPKEY 权限超限或订单到期，请联系管理员";
      } else if (data.DataStatus?.StatusCode === 504) {
        userMessage = "APPKEY 错误，请联系管理员";
      } else if (data.DataStatus?.StatusCode === 505) {
        userMessage = "请求次数超出限制，请稍后再试";
      } else if (data.DataStatus?.StatusCode === 429 || data.DataStatus?.StatusCode === 502) {
        userMessage = "请求频率过高，请稍后再试";
      }

      return NextResponse.json(
        {
          success: false,
          message: userMessage,
          code: data.DataStatus?.StatusCode,
        },
        { status: 500 }
      );
    }

    // 获取 PDF 链接
    const pdfUrl = data.Data;
    if (!pdfUrl) {
      console.error("❌ [Markdown转PDF] 未获取到 PDF 链接");
      return NextResponse.json(
        {
          success: false,
          message: "未获取到 PDF 链接",
        },
        { status: 500 }
      );
    }

    console.log("✅ [Markdown转PDF] PDF 链接获取成功:", pdfUrl);

    // 直接返回 PDF 链接，让前端处理下载
    return NextResponse.json(
      {
        success: true,
        pdfUrl: pdfUrl,
        message: "PDF 生成成功",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ [Markdown转PDF] 处理请求失败:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "处理请求失败",
      },
      { status: 500 }
    );
  }
}
