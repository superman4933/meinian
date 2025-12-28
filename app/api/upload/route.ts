import { NextRequest, NextResponse } from "next/server";
import { getCozeToken } from "@/lib/coze-config";

// 处理 GET 请求，返回方法不允许的错误
export async function GET() {
  return NextResponse.json(
    { success: false, message: "此接口仅支持 POST 方法，请使用 POST 请求上传文件" },
    { status: 405 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "未找到文件" },
        { status: 400 }
      );
    }

    // 调用扣子API上传文件
    const cozeFormData = new FormData();
    cozeFormData.append("file", file);

    // 获取扣子API Token（优先从请求头读取，如果没有则使用默认值）
    const tokenFromHeader = request.headers.get("x-coze-token");
    const cozeToken = tokenFromHeader || getCozeToken(request);

    const response = await fetch("https://api.coze.cn/v1/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cozeToken}`,
        // 注意：不要设置 Content-Type，让浏览器自动设置，包含 boundary
      },
      body: cozeFormData,
    });

    let data;
    try {
      data = await response.json();
    } catch (e) {
      // 如果响应不是JSON格式
      const text = await response.text();
      if (process.env.NODE_ENV === 'development') {
        console.error("扣子API返回非JSON响应:", {
          status: response.status,
          statusText: response.statusText,
          body: text,
        });
      }
      
      return NextResponse.json(
        {
          success: false,
          message: `扣子API返回错误 (${response.status}): ${response.statusText}`,
          error_source: "扣子API",
          status: response.status,
          response_body: text,
        },
        { status: response.status }
      );
    }

    if (!response.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.error("扣子API上传失败:", {
          status: response.status,
          statusText: response.statusText,
          data: data,
        });
      }
      
      return NextResponse.json(
        {
          success: false,
          message: `扣子API返回错误: ${data.message || data.error || response.statusText || "未知错误"}`,
          error_source: "扣子API",
          error_code: data.code || data.error_code,
          status: response.status,
          details: data,
        },
        { status: response.status }
      );
    }

    // 记录上传成功的详细信息（仅开发环境）
    const fileId = data.id || data.file_id || data.data?.id || data.data?.file_id;
    if (process.env.NODE_ENV === 'development') {
      console.log("文件上传成功 - 扣子API返回数据:", {
        fileName: file.name,
        fileSize: file.size,
        rawResponse: JSON.stringify(data, null, 2),
        extractedFileId: fileId,
        allKeys: Object.keys(data),
      });
    }

    return NextResponse.json({
      success: true,
      file_id: fileId,
      file_name: file.name,
      file_size: file.size,
      url: data.url || data.download_url || data.data?.url || null,
      // 返回原始数据用于调试
      _debug: {
        rawResponse: data,
        extractedFileId: fileId,
      },
    });
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error("Upload error:", error);
    }
    return NextResponse.json(
      {
        success: false,
        message: error.message || "上传失败，请稍后重试",
      },
      { status: 500 }
    );
  }
}

